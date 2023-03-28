# boilerplate
import tqdm, numpy as np, pickle
import matplotlib.pyplot as plt
import logging, pickle
from bson.objectid import ObjectId
import gc
from pathlib import Path
import time
import gridfs
import datetime

# ml dependencies
import umap
import hdbscan
from sklearn.metrics.pairwise import euclidean_distances
import spacy

# local files
import utils
import tasks

def cluster_by_groups(userid, group_id_strings, session_oid, limit=10000):
    """Cluster documents using user-defined groups.

    Clusters 'limit' documents with respect to the documents already 
    grouped in group_id_strings. User-defined groups are to be maintained, and 
    clusters are given topic model labels. 

    Args:
        userid:
            An ObjectID representing the user who made the API call
        group_id_strings:
            A list of strings representing the ObjectID of each group
            to be clustered
        session_oid:
            An string that represents the ObjectID of the current session
        limit:
            The number of documents to cluster. Default 10000
    """

    start = time.time()

    # connect to the database
    db = utils.connect()

    # if user already has clusters, delete them to prepare for new clusters
    clean_mongodb(db, userid)
    
    # Create list of ObjectIds from human clusters
    group_ids = [ObjectId(str(id)) for id in group_id_strings]

    # Get the groups from mongoDB
    logging.info(f'Getting all groups in {group_ids}.')
    groups = list(db.groups.find({"_id":{"$in" : group_ids}}))

    # build of training set: 
    # dm - distance matrix 
    # group_doc_indices - 
    dm, group_doc_indices, document_ids = document_ordering(
        db, 
        groups, 
        limit
    )

    logging.info("Running UMAP Reduction...")
    umap_embeddings = umap.UMAP(
        verbose = True,         # for logging
        metric = "precomputed", # use distance matrix
        n_components = 30,      # reduce to n_components dimensions (2:100)
        # n_neighbors = 10,     # local (small n ~2) vs. global (large n ~100) structure 
        min_dist = 1e-5,        # minimum distance apart that points are allowed (0.0:0.99)
    ).fit_transform(dm)
    logging.info(f"Shape after reduction: {umap_embeddings.shape}")
    
    # for garbage collection
    del dm
    gc.collect()
    logging.info("Bye distance matrix!!")
    
    logging.info("Clustering with HDBSCAN...")
    hdbscan_labels = hdbscan.HDBSCAN(
        min_cluster_size = 10,              # n-neighbors needed to be considered a cluster (0:50 df=5)
        # min_samples = 5,                  # how conservative clustering will be, larger is more conservative (more outliers) (df=None)
        cluster_selection_epsilon = 0.2,    # have large clusters in dense regions while leaving smaller clusters small
                                            # merge clusters if inter cluster distance is less than thres (df=0)
    ).fit_predict(umap_embeddings)

    logging.info(f'Num Clusters = {max(hdbscan_labels)+1} + outliers')

    # for garbage collection
    del umap_embeddings
    gc.collect()
    logging.info("Bye UMAP embedding!!")

    # identify what machine label was given to each group
    given_labels = {}
    for group in group_doc_indices:
        
        # list of labels given to docs in group
        labels = hdbscan_labels[group_doc_indices[group]] 
        # get non -1 label (if exists)
        correct_label = max(labels)
        
        # if any documents were given -1, make sure they are set to correct_label
        if -1 in labels:
            for i in range(len(labels)):
                if labels[i] == -1:
                    index = group_doc_indices[group][i]
                    hdbscan_labels[index] = correct_label
        
        given_labels[group] = correct_label

    # spaCy preprocessing object for machine labels
    nlp = spacy.load("en_core_web_sm")

    # keep track of all topic labels (for collisions)
    topic_labels = []

    # create a new mongoDB group for each machine cluster
    for hdbscan_label in set(hdbscan_labels):
        
        # array of indices of documents with current hdbscan label
        document_indices_array = np.where(hdbscan_labels == hdbscan_label)[0]
        
        # all document_ids as array
        ids = np.array(document_ids)
        
        # array of object ids of documents with current hdbscan label 
        label_ids = ids[document_indices_array]

        # create list of document object ids that are in current hdbscan label
        documents = label_ids.tolist()
        
        # create appropriate label for current hdbscan label
        _label, _color = get_label(hdbscan_label, given_labels)
        
        # learn a topic label for if current cluster is a machine cluster
        if _label == 'machine':
            limit = min(20, len(label_ids))
            _label = get_topic(db, label_ids[:limit], nlp, topic_labels)
            topic_labels.append(_label)

        logging.info(f'There are {len(documents)} documents for Machine Cluster "{_label}".')
        
        tasks.add_group(
            userid=userid,
            label=_label,
            color=_color,
            session_id=session_oid, 
            human=False, 
            included_documents=documents, 
        )

    total_time = time.time() - start
    num_clusters = max(hdbscan_labels) + 2
    session_action(session_oid, num_clusters, groups, total_time)
     
def document_ordering(db, groups, limit):
    """ Build a training set besed on the average of groups' teleoscopes

    Args:
        db:
            A connection to the MongoDB database.
        groups: 
            A list of ObjectIds representing each group to be clustered
        limit:
            The number of documents to cluster.  

    Returns:
        dm:
            a diagonal matrix containing where elements are distances between documents
        group_doc_indices:
            dict where keys are group names and values are indices of documents in said group
        document_ids:
            A list of document object ids
    """
    
    logging.info("Gathering all document vectors from embeddings...")
    # grab all document data from embeddings
    reorient = tasks.reorient()
    all_doc_ids, all_doc_vecs = reorient.cacheDocumentsData()

    logging.info('Using average ordering...')
    # get teleoscope vecs of given groups
    teleo_vecs = []
    for group in groups:

        teleoscope_oid = group["teleoscope"]
        teleoscope = db.teleoscopes.find_one({"_id": ObjectId(str(teleoscope_oid))})
        teleo_vecs.append(teleoscope["history"][0]["stateVector"])

    teleo_vecs = np.array(teleo_vecs)

    # compute average teleoscope vec
    vec = np.average(teleo_vecs, axis=0)

    logging.info("Gather similarly scores based on vector...")
    # gather similarly scores based on average vector
    scores = utils.calculateSimilarity(all_doc_vecs, vec)

    logging.info("Sorting document ids based on scores...")
    # sort document ids based on scores and take subset based on limit param
    document_ids = utils.rank_document_ids_by_similarity(all_doc_ids, scores)[:limit]

    # indices of ranked ids
    indices = [all_doc_ids.index(i) for i in document_ids]

    logging.info("Building sorted array of document vectors...")
    # use indices of ranked ids to build sorted array of document vectors
    document_vectors = np.array([all_doc_vecs[i] for i in indices])

    # dict where keys are group names and values are indices of documents
    group_doc_indices = {}
    
    # make sure documents in groups are included in training sets
    logging.info("Appending documents from groups to document vector and id list...")
    for group in groups:

        group_document_ids = group["history"][0]["included_documents"]

        indices = []

        for str_id in group_document_ids:

            # see if document is already in training sets
            try:
                id = ObjectId(str(str_id))
                document_ids.index(str(id))

            # if not add document to training sets
            except:
                document = db.documents.find_one(
                    {"_id": id},
                    projection={'textVector': 1},
                )
                if not document: raise Exception(f"Document {str(id)} not found")
                document_ids.append(str(id))
                vector = np.array(document["textVector"]).reshape((1, 512))
                document_vectors = np.append(document_vectors, vector, axis=0)

            # get index of document in group with respect to training sets
            finally:
                indices.append(document_ids.index(str(id)))

        group_doc_indices[group["history"][0]["label"]] = indices

    # build distance matrix
    logging.info("Building distance matrix...")
    dm = euclidean_distances(document_vectors)
    logging.info(f"Distance matrix has shape {dm.shape}.") # n-by-n symmetrical matrix

    # update distance matrix such that documents in the same group have distance ~0
    INTRA_CLUSTER_DISTANCE = 1e-4
    for group in group_doc_indices:

        indices = group_doc_indices[group]
        size = range(len(indices))

        for _i in size:
            i = indices[_i]

            for _j in size:
                j = indices[_j]
                dm[i, j] *= INTRA_CLUSTER_DISTANCE

    return dm, group_doc_indices, document_ids

def get_label(hdbscan_label, given_labels):
    """Identify and produce label & colour for given hdbscan label

    Args:
        hdbscan_label:
            An int that represents the given machine label 
        given_labels: 
            A dictionary with keys that represent group names 
            and values that represent given machine labels

    Returns:
        label:
            A string that is the topic label for the machine cluster
        colour:
            A string of hex representing a colour
    """
    
    check = more = False
    
    # outlier label
    if hdbscan_label == -1:
        return 'outliers', '#ff1919'

    # check if hdbscan_label was for a human cluster(s)
    for _name in given_labels:

        label = given_labels[_name]
        
        if (hdbscan_label == label):
            
            # append group labels if multiple human clusters are given the same hdbscan label
            if more:
                name += " & " + _name 

            # on first instance of label match, just return name
            else:
                name = _name
                check = more = True
    
    if check:
        return name, '#ff70e2'

    # return for if label is newly generated machine cluster
    return 'machine', '#737373'

def get_topic(db, label_ids, nlp, topic_labels):
    """Provides a topic label for a machine cluster

    Args:
        db:
            A connection to the MongoDB database.
        label_ids: 
            An array of strings that represent documents ids in a machine cluster.
        nlp:
            spaCy prepocessing helper.
        topic_lables:
            list of all given labels to machine clusters

    Returns:
        topic:
            A string that is the topic label for the machine cluster
    """

    docs = [] 
    
    # build a small corpus of documents that represent a machine cluster
    for id in label_ids:
        document = list(db.documents.find(
            {"_id": ObjectId(str(id))},
            projection = {'text': 1},
        ))
        docs.append(document[0]["text"])
        
    # use spaCy to preprocess text
    docs_pp = [preprocess(text) for text in nlp.pipe(docs)]

    # transform as bag of words
    from sklearn.feature_extraction.text import CountVectorizer
    vec = CountVectorizer(stop_words='english')
    X = vec.fit_transform(docs_pp)

    # apply LDA topic modelling reduction
    from sklearn.decomposition import LatentDirichletAllocation
    lda = LatentDirichletAllocation(
        n_components=1, 
        learning_method="batch", 
        max_iter=10
    )
    lda.fit_transform(X)

    # grab two most similar topic labels for machine cluster
    sorting = np.argsort(lda.components_, axis=1)[:, ::-1]
    feature_names = np.array(vec.get_feature_names_out())
    label = feature_names[sorting[0][0]] + " " + feature_names[sorting[0][1]]

    # check for collisions with existing labels; if yes, append another topic label. 
    i = 1
    while(1):
        if label not in topic_labels:
            return label
        else:
            i += 1
            label += " " + feature_names[sorting[0][i]]

def preprocess(
    doc,
    min_token_len=2,
    irrelevant_pos=["ADV", "PRON", "CCONJ", "PUNCT", "PART", "DET", "ADP", "SPACE"],
):
    """Preprocess text

    Code by Dr. Varada Kolhatkar adapted from UBC CPSC 330

    Given text, min_token_len, and irrelevant_pos carry out preprocessing of the text
    and return a preprocessed string.

    Args:
        doc:
            The spacy doc object of the text
        min_token_len: 
            An int that represents min_token_length required
        irrelevant_pos: 
            A list of irrelevant pos tags

    Returns:
        preprocessed_text:
            Preprocessed text as a String
    """

    clean_text = []

    for token in doc:
        if (
            token.is_stop == False  # Check if it's not a stopword
            and len(token) > min_token_len  # Check if the word meets minimum threshold
            and token.pos_ not in irrelevant_pos
        ):  # Check if the POS is in the acceptable POS tags
            lemma = token.lemma_  # Take the lemma of the word
            clean_text.append(lemma.lower())
    return " ".join(clean_text)

def clean_mongodb(db, userid):
    """Cleans up MongoDB objects

    Check to see if user has already built clusters.
    If so, need to delete clusters and associated teleoscope items

    Args:
        db: 
            A connection to the MongoDB database.
        userid:
            An ObjectID representing the user who made the API call
    """

    # check to see user has any clusters
    if db.clusters.count_documents(
        { "history.user": ObjectId(str(userid))}, 
        limit=1,
    ):
        
        logging.info(f'Clusters for user exists. Delete all.')

        namespace = "teleoscopes" # teleoscopes.chunks, teleoscopes.files
        fs = gridfs.GridFS(db, namespace)

        # cursor to find all existing clusters
        cursor = db.clusters.find(
            { "history.user" : ObjectId(str(userid))},
            projection = {'_id': 1, 'teleoscope': 1},
        )    

        # tidy up all existing clusters
        for cluster in tqdm.tqdm(cursor):

            # cluster teleoscope
            teleo_oid = cluster["teleoscope"]
            teleo = db.teleoscopes.find_one({"_id": teleo_oid})

            # associated teleoscope.files
            teleo_file = teleo["history"][0]["ranked_document_ids"]

            # delete telescopes.chunks and teleoscopes.files
            fs.delete(teleo_file)

            # delete teleoscope 
            db.teleoscopes.delete_one({"_id": teleo_oid})

            # delete cluster
            db.clusters.delete_one({"_id": cluster["_id"]})
    
    logging.info(f'No clusters for user. Ready to populate.')

    pass

def session_action(session_oid, num_clusters, groups, total_time):
    """Clustering action history update

    Push an update to the session object to document the state of clustering 

    Args:
        session_oid: 
            An int that represents the ObjectID of the current session
        num_clusters:
            An int that represents the number of clusters produced by HDBSCAN
        groups:
            A list of group objects that were clustered on
    """

    logging.info(f'Clustering action history update.')

    transaction_session, db = utils.create_transaction_session()
    session_id = ObjectId(str(session_oid))
    session = db.sessions.find_one({"_id": session_id}, {"history": { "$slice": 1}})  

    history_item = session["history"][0]
    history_item["timestamp"] = datetime.datetime.utcnow()

    copy = f'Built {num_clusters} clusters in {total_time} seconds'
    logging.info(copy)
    history_item["action"] = copy

    # record the groups and their associated documents used for clustering
    history_item["clustered_groups"] = []
    for group in groups:

        # documents used for clustering are denoting using the length of the groups history item.
        # the index of said documents are at [current history length - denoted history length]
        history_item["clustered_groups"].append({
            "group_id": group["_id"],
            "position": len(group["history"])
        })

    with transaction_session.start_transaction():
        db.sessions.update_one({"_id": session_id},
            {
                '$push': {
                    "history": {
                        "$each": [history_item],
                        "$position": 0
                    }
                }
            }, session=transaction_session)
        utils.commit_with_retry(transaction_session)

    return 200 

def cache_documents(path='~/embeddings/'):

    reorient = tasks.reorient()
    # allDocumentIDs, allDocumentVectors = reorient.cacheDocumentsData()

    # dir = Path(path).expanduser()
    # dir.mkdir(parents=True, exist_ok=True)
    # npzpath = Path(path + 'embeddings.npz').expanduser()
    # pklpath = Path(path + 'ids.pkl').expanduser()
    
    # if npzpath.exists() and pklpath.exists():
    #     logging.info("Documents have been cached, retrieving now.")
    #     loadDocuments = np.load(npzpath.as_posix(), allow_pickle=False)
    #     with open(pklpath.as_posix(), 'rb') as handle:
    #         allDocumentIDs = pickle.load(handle)
    #     allDocumentVectors = loadDocuments['documents']
    # else:
    #     logging.info("Documents are not cached, building cache now.")
    #     db = utils.connect()
    #     allDocuments = utils.getAllDocuments(db, projection={'textVector':1, '_id':1}, batching=True, batchSize=10000)
    #     ids = [str(x['_id']) for x in allDocuments]
    #     logging.info(f'There are {len(ids)} ids in documents.')
    #     vecs = np.array([x['textVector'] for x in allDocuments])

    #     np.savez(npzpath.as_posix(), documents=vecs)
    #     with open(pklpath.as_posix(), 'wb') as handle:
    #         pickle.dump(ids, handle, protocol=pickle.HIGHEST_PROTOCOL)
    #     allDocumentIDs = ids
    #     allDocumentVectors = vecs

    return reorient.cacheDocumentsData()