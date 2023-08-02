# boilerplate
import numpy as np
import logging
from bson.objectid import ObjectId
from pymongo import database
from random_object_id import generate
import random

# ml dependencies
import umap
import hdbscan
from sklearn.metrics.pairwise import euclidean_distances, cosine_distances
import spacy

# local files
from . import utils
from . import tasks
from . import auth
from . import schemas
from . import graph

class Projection:
    """Semi-supervised Clustering 

    The purpose of this class is to cluster a corpus--limited to a subset defined 
    by the limit param plus the documents in the provided human clusters/groups.
    """

    def __init__(self, db: database.Database, sources, controls, limit=20000, topic_label_length=2):
        """Initializes the instance 

        Args:
            sources:
                list of source inputs: group, document, search, note 
            controls:
                list of control inputs: group, document, search, note 
            limit:
                The number of documents to cluster. Default 10000
            topic_label_length:
                Minimum number of words to use for machine cluster topic labels. Default 2
        """

        # self.dbstring = None
        # self.transaction_session = None
        # self.user_id = None
        # self.group_id_strings = None
        # self.projection_id = None
        # self.session_id = None
        self.db = db
        self.sources = sources
        self.controls = controls
        self.limit = limit
        self.topic_label_length = topic_label_length
        self.description = ""
        self.group_doc_indices = None
        self.groups = []

        # large lists (number of examples)
        self.nlp = spacy.load("en_core_web_sm")
        self.document_ids = None    
        self.hdbscan_labels = None
        self.doclists = []
        self.doc_groups = []

    def clustering_task(self):
        """Cluster documents using user-defined groups.
        """

        # build distance matrix, run dimensionality reduction, run clustering
        self.learn_clusters()

        # iteratively add clusters (as groups) to database
        self.build_clusters()

        return self.doclists

    def learn_clusters(self):
        """ Learn cluster labels: build distance matrix, run dimensionality reduction, run clustering
        """

        # build training set
        dm = self.document_ordering()


        """
            best params from march:
            n_components = 30, min_dist = 1e-5, min_cluster_size = 10, cluster_selection_epsilon = 0.2

            notes from turning:
                - dont hit thresh. if min_cluster_size > 7-8
                - increase min samples, increase clusters
                - increase epsilon, decrease clusters
                - large n_components requires larger n_neighbors
                - increasing n_neighbors, decreases clusters
                - n_components greater than 10 are much the same, less than 10 are bad.
                - 11 was most frequent nn for thresh.
                - https://maartengr.github.io/BERTopic/getting_started/parameter%20tuning/parametertuning.html#umap
        """

        n_components = random.randint(10, 12)
        n_neighbors = random.randint(n_components, 13)
        min_dist = 1e-4
        
        logging.info("Running UMAP Reduction...")
        umap_embeddings = umap.UMAP(
            metric = "precomputed", # use distance matrix
            n_components = n_components,      # reduce to n_components dimensions (2~100)
            n_neighbors = n_neighbors,     # local (small n ~2) vs. global (large n ~100) structure 
            min_dist = min_dist,        # minimum distance apart that points are allowed (0.0~0.99)
        ).fit_transform(dm)
                
        
        logging.info("Running HDBSCAN clustering...")
        logging.info('----------------epochs-----------------')
        logging.info('{:<12s}{:<10s}'.format('Attempt','Num. Clusters'))
        logging.info('---------------------------------------')

        i, num_clust, min_cluster_size, min_samples, cluster_selection_epsilon = 0, 0, 0, 0, 0.0

        while (num_clust < 10 or num_clust > 100):
        
            min_cluster_size = random.randint(6, 8)
            min_samples = random.randint(1, 4)
            cluster_selection_epsilon = random.uniform(0.26, 0.29)
                
            self.hdbscan_labels = hdbscan.HDBSCAN(
                min_cluster_size = min_cluster_size,              # num of neighbors needed to be considered a cluster (0~50, df=5)
                min_samples = min_samples,                  # how conservative clustering will be, larger is more conservative (more outliers) (df=None)
                cluster_selection_epsilon = cluster_selection_epsilon,    # have large clusters in dense regions while leaving smaller clusters small
                                                                        # merge clusters if inter cluster distance is less than thres (df=0)
            ).fit_predict(umap_embeddings)

            num_clust = len(set(self.hdbscan_labels))
            i+=1 #epoch

            logging.info('{:<12d}{:<10d}'.format(i,num_clust))

            if i == 100: raise Exception(f"Sorry, bad luck. dump: {num_clust}")

        logging.info('---------umap-hyperparameters----------')
        logging.info('{:<28s}{:<5d}'.format('n_components:',n_components))
        logging.info('{:<28s}{:<5d}'.format('n_neighbors:',n_neighbors))
        logging.info('{:<28s}{:<5f}'.format('min_dist:',min_dist))

        logging.info('--------hdbscan-hyperparameters--------')
        logging.info('{:<28s}{:<5d}'.format('min_cluster_size:',min_cluster_size))
        logging.info('{:<28s}{:<5d}'.format('min_samples:',min_samples))
        logging.info('{:<28s}{:<3f}'.format('cluster_selection_epsilon:',cluster_selection_epsilon))

        logging.info('---------------results-----------------')
        logging.info('{:<28s}{:<5d}'.format('number of clusters:',len(set(self.hdbscan_labels))))

        # # CODE FOR TUNING
        # res = {}
        # count = 0
        # try:

        #     for n_components in range(5,30,3):
        #         logging.info(f"ncomp {n_components}")
        #         for n_neighbors in range(5,30,3):
        #             logging.info(f"nn {n_neighbors}")

        #             umap_embeddings = umap.UMAP(
        #                 verbose = True,         # for logging
        #                 metric = "precomputed", # use distance matrix
        #                 n_components = n_components,      # reduce to n_components dimensions (2~100)
        #                 n_neighbors = n_neighbors,     # local (small n ~2) vs. global (large n ~100) structure 
        #                 min_dist = min_dist,        # minimum distance apart that points are allowed (0.0~0.99)
        #             ).fit_transform(dm)

        
        #             self.hdbscan_labels = hdbscan.HDBSCAN(
        #                 min_cluster_size = 7,              # num of neighbors needed to be considered a cluster (0~50, df=5)
        #                 min_samples = 2,                  # how conservative clustering will be, larger is more conservative (more outliers) (df=None)
        #                 cluster_selection_epsilon = .27,    # have large clusters in dense regions while leaving smaller clusters small
        #                                                                         # merge clusters if inter cluster distance is less than thres (df=0)
        #             ).fit_predict(umap_embeddings)
            
        #             if len(set(self.hdbscan_labels)) > 20 and len(set(self.hdbscan_labels)) < 90:
        #                 res[count] = {
        #                     'clusters': len(set(self.hdbscan_labels)),
        #                     'n_components': n_components,
        #                     'n_neighbors': n_neighbors,
        #                 }
        #                 count+=1
        #                 logging.info(f"||||||||FOUND|||||||FOUND||||||||||FOUND||||||||||")
        #                 logging.info(f"{len(set(self.hdbscan_labels))} clusters.")


        #     logging.info(f"dump {res}")
        #     with open('result.json', 'w') as fp:
        #         json.dump(res, fp) 
       
        # except KeyboardInterrupt:
        #     logging.info(f"dump {res}")
        #     with open('result.json', 'w') as fp:
        #         json.dump(res, fp) 
        

    def build_clusters(self):
        """ Iteratively builds groups in mongoDB relative to clustering
        """

        # identify what machine label was given to each group
        given_labels = self.get_given_labels()

        # keep track of all topic labels (for collisions)
        topic_labels = []
      
        logging.info('---------------------------------------')
        logging.info('{:<20s}{:<4s}'.format('Label','Num. Docs'))
        logging.info('---------------------------------------')

        # create a new mongoDB group for each machine cluster
        for hdbscan_label in set(self.hdbscan_labels):
            
            # array of indices of documents with current hdbscan label
            document_indices_array = np.where(self.hdbscan_labels == hdbscan_label)[0]
            
            # all document_ids as array
            ids = np.array(self.document_ids)
            
            # array of object ids of documents with current hdbscan label 
            label_ids = ids[document_indices_array]

            # create list of document object ids that are in current hdbscan label
            documents = label_ids.tolist()
            
            # create appropriate label for current hdbscan label
            _label, _color = self.get_label(hdbscan_label, given_labels)
            
            # learn a topic label for if current cluster is a machine cluster
            if _label == 'machine':
                limit = min(20, len(label_ids))
                _label = self.get_topic(label_ids[:limit], topic_labels)
                topic_labels.append(_label)

            # logging.info(f'Cluster: "{_label}" has {len(documents)} documents')
            logging.info('{:<20s}{:<4d}'.format(_label,len(documents)))
            
            self.add_cluster(documents, _label, _color)
        
        # clear any groups that were made for individual document inputs
        for group in self.doc_groups:
            self.db.groups.delete_one({"_id": group}) 

    def get_given_labels(self):
        """ Build the given_labels dictionary

        Returns:
            given_labels:
                dict where keys are group names and values are the given hdbscan label
        """
        
        given_labels = {}
        for group in self.group_doc_indices:
            
            # list of labels given to docs in group
            labels = self.hdbscan_labels[self.group_doc_indices[group]] 
            # get non -1 label (if exists)
            correct_label = -1 if len(labels) == 0 else max(labels)
            
            # if any documents were given -1, make sure they are set to correct_label
            if -1 in labels:
                for i in range(len(labels)):
                    if labels[i] == -1:
                        index = self.group_doc_indices[group][i]
                        self.hdbscan_labels[index] = correct_label
            
            given_labels[group] = correct_label

        return given_labels
    
    def document_ordering(self):
        """ Build a training set besed on the average of groups' document vectors

        Returns:
            dm:
                a diagonal matrix containing where elements are distances between documents
        """

        for c in self.controls:
            match c["type"]:
                case "Document":
                    # create temp group
                    obj = schemas.create_group_object(
                        "#FF0000", 
                        [c["id"]], 
                        "Your Document", 
                        "Initialize group", 
                        ObjectId(generate()), # random id
                        "Group from Document",
                        ObjectId(generate()), # random id
                    )
                    # Initialize group in database
                    res = self.db.groups.insert_one(obj)
                    oid = res.inserted_id
                    group = self.db.groups.find_one({"_id": oid})
                    self.doc_groups.append(oid)
                    self.groups.append(group)

                case "Group":
                    group = self.db.groups.find_one({"_id": c["id"]})
                    self.groups.append(group)
                case "Search":
                    pass
                case "Note":
                    pass

        logging.info("Gathering all document vectors from embeddings...")
        # grab all document data from embeddings
        all_doc_ids, all_doc_vecs = utils.get_documents(self.db.name)

        # if sources = 0: average ordering of conrolls for all[30000]
        if len(self.sources) == 0:

            logging.info('No sources. Using average ordering...')
            
            # build a list of ids of documents in all groups 
            docs = []
            for group in self.groups:
                group_document_ids = group["history"][0]["included_documents"]
                docs += group_document_ids
            
            # get control vectors
            control_vecs = [all_doc_vecs[all_doc_ids.index(oid)] for oid in docs]
            source_vecs = np.array(all_doc_vecs)
            ranks = graph.rank(control_vecs, all_doc_ids, source_vecs, self.limit)
            document_ids = [i for i,s in ranks] 
        
        else:
            # if sources > 0: sources U controls 
            document_ids = []

            for source in self.sources:
                match source["type"]:
                    case "Document":
                        document_ids.append(source["id"])

                    case "Group":
                        group = self.db.groups.find_one({"_id": source["id"]})
                        document_ids.append(group["history"][0]["included_documents"])

                    case "Search":
                        search = self.db.searches.find_one({"_id": source["id"]})
                        cursor = self.db.documents.find(utils.make_query(search["history"][0]["query"]),projection={ "_id": 1}).limit(self.limit)
                        document_ids += [d["_id"] for d in list(cursor)]

                    case "Note":
                        pass
            
            # remove duplicate ids
            document_ids = list(dict.fromkeys(document_ids))
 
        # Create a dictionary to store the indices of all_doc_ids
        index_dict = {all_doc_ids[i]: i for i in range(len(all_doc_ids))}

        # Get the indices of document_ids using the dictionary
        indices = [index_dict[i] for i in document_ids]

        logging.info("Building sorted array of document vectors...")
        # use indices of ranked ids to build sorted array of document vectors
        document_vectors = np.array([all_doc_vecs[i] for i in indices])
        logging.info(f"Document vectors are length: {len(document_vectors)}")
        # dict where keys are group names and values are indices of documents
        group_doc_indices = {}
        
        # make sure documents in groups are included in training sets
        logging.info("Appending documents from groups to document vector and id list...")
        for group in self.groups:

            group_document_ids = group["history"][0]["included_documents"]

            indices = []

            for str_id in group_document_ids:

                # see if document is already in training sets
                try:
                    id = ObjectId(str(str_id))
                    document_ids.index(str(id))

                # if not add document to training sets
                except:
                    document = self.db.documents.find_one(
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
        dm = cosine_distances(document_vectors)
        logging.info(f"Distance matrix has shape {dm.shape}.") # n-by-n symmetrical matrix

        # update distance matrix such that documents in the same group have distance ~0
        INTRA_CLUSTER_DISTANCE = 1e-2
        for group in group_doc_indices:

            indices = group_doc_indices[group]
            size = range(len(indices))

            for _i in size:
                i = indices[_i]

                for _j in size:
                    j = indices[_j]
                    dm[i, j] *= INTRA_CLUSTER_DISTANCE

        self.group_doc_indices = group_doc_indices
        self.document_ids = document_ids

        return dm

    def get_label(self, hdbscan_label, given_labels):
        """Identify and produce label & colour for given hdbscan label

        Args:
            hdbscan_label:
                An int that represents the given machine label 
            given_labels:
                dict where keys are group names and values are the given hdbscan label

        Returns:
            label:
                A string that is the topic label for the machine cluster
            colour:
                A string of hex representing a colour
        """
        
        check = more = False
        
        # outlier label
        if hdbscan_label == -1:
            self.description = "outlier documents"
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
            self.description = "your group"
            return name, '#ff70e2'

        # return for if label is newly generated machine cluster
        return 'machine', '#737373'

    def get_topic(self, label_ids, topic_labels):
        """Provides a topic label for a machine cluster

        Args:
            label_ids: 
                An array of strings that represent documents ids in a machine cluster.
            topic_lables:
                list of all given labels to machine clusters

        Returns:
            topic:
                A string that is the topic label for the machine cluster
            description:
                A 10 word machine generated description 
        """

        docs = [] 
        
        # build a small corpus of documents that represent a machine cluster
        for id in label_ids:
            document = list(self.db.documents.find(
                {"_id": ObjectId(str(id))},
                projection = {'text': 1},
            ))
            docs.append(document[0]["text"])
            
        # use spaCy to preprocess text
        docs_pp = [self.preprocess(text) for text in self.nlp.pipe(docs)]

        # transform as bag of words with tf-idf strategy
        from sklearn.feature_extraction.text import TfidfVectorizer
        vec = TfidfVectorizer()
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

        label = ""
        for i in range(self.topic_label_length):
            if i > 0: label += " "
            try:
                label += feature_names[sorting[0][i]]
            except:
                pass

        # build a 7 word description from frequent topic labels
        self.description = feature_names[sorting[0][0]]
        for i in range(1, min(8, len(sorting[0]))):
            self.description += " " + feature_names[sorting[0][i]]

        # check for collisions with existing labels; if yes, append another topic label. 
        i = self.topic_label_length
        while(1):
            if label not in topic_labels:
                return label
            else:
                label += " " + feature_names[sorting[0][i]]
                i += 1

    def preprocess(self, doc):
        """Preprocess text

        Code by Dr. Varada Kolhatkar adapted from UBC CPSC 330

        Given text, min_token_len, and irrelevant_pos carry out preprocessing of the text
        and return a preprocessed string.

        Args:
            doc:
                The spacy doc object of the text

        Returns:
            preprocessed_text:
                Preprocessed text as a String
        """
                
        # An int that represents min_token_length required
        min_token_len = 2
        # A list of irrelevant pos tags
        irrelevant_pos = ["ADV", "PRON", "CCONJ", "PUNCT", "PART", "DET", "ADP", "SPACE"]

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
    
    def add_cluster(self, documents, label, color):
        """
        Adds a cluster to projection
        """

        doclist = {
            "ranked_documents": [(d, 1.0) for d in documents],
            "label": label,
            "color": color,
            "type": "Cluster"
        }

        self.doclists.append(doclist)
        
