import logging, pickle, utils, json, auth, numpy as np, tensorflow_hub as hub
from warnings import simplefilter
from gridfs import GridFS
from celery import Celery, Task

# ignore all future warnings
simplefilter(action='ignore', category=FutureWarning)

# url: "amqp://myuser:mypassword@localhost:5672/myvhost"
CELERY_BROKER_URL = (
    f'amqp://'
    f'{auth.rabbitmq["username"]}:'
    f'{auth.rabbitmq["password"]}@'
    f'{auth.rabbitmq["host"]}/'
    f'{auth.rabbitmq["vhost"]}'
)

app = Celery('tasks', backend='rpc://', broker=CELERY_BROKER_URL)
app.conf.update(
    task_serializer='pickle',
    accept_content=['pickle'],  # Ignore other content
    result_serializer='pickle',
)
'''
import_single_post

input: String (Path to json file)
output: void
purpose: This function is used to import a single post from a json file to a database
'''
@app.task
def import_single_post(path_to_post):
    
    # Read file
    with open(path_to_post) as f:
            data = json.load(f)[0]['data']['children'][0]['data']

    # Connect to database
    db = utils.connect()

    # extract relevent fields
    post = {
        'author': data['author'],
        'author_fullname': data['author_fullname'],
        'created_utc': data['created_utc'],
        'full_link': data['url'],
        'id': data['id'],
        'num_comments': data['num_comments'],
        'score': data['score'],
        'selftext': data['selftext'],
        'title': data['title'],
    }

    # add to database
    db.posts.insert_one(post)




'''
querySearch:
Performs a text query on aita.clean.posts.v2 text index.
If the query string alredy exists in the teleoscopes collection, returns existing reddit_ids.
Otherwise, adds the query to the teleoscopes collection and performs a text query the results of which are added to the
teleoscopes collection and returned.
TODO: 
1. We can use GridFS to store the results of the query if needed (if sizeof(reddit_ids) > 16MB).
   Doesnt seem to be an issue right now.
2. Checks for both teleoscope_id and query. Need confirmation from frontend on whether the teleoscope_id and/or query will already exist?
   If not, then who updates them?
'''
@app.task
def initialize_teleoscope(label):
    db = utils.connect()
    
    if label == "":
        logging.info(f"label {label} is empty.")
        return []

    logging.info("About to insert a new document")
    # create a new query document
    teleoscope_id = db.teleoscopes.insert_one({
        "label": label,
        "rank_slice": [],
        "reddit_ids": [],
        "history": []
        }
    )
    logging.info(f"The new teleoscope has an id of: {teleoscope_id.inserted_id}")

    # perform text search query
    labelAsTextSearch = {"$text": {"$search": label}}
    cursor = db.clean.posts.v2.find(labelAsTextSearch, projection = {'id':1})
    return_ids = [x['id'] for x in cursor]

    # store results in teleoscopes collection
    db.teleoscopes.update_one({'_id': teleoscope_id.inserted_id}, {'$set': {'reddit_ids': return_ids}})
    
    logging.info(f"label {label} added to teleoscopes collection")
    return return_ids

@app.task
def save_teleoscope_state(*args, **kwargs):
    db = utils.connect()
    logging.info(f'Saving state for teleoscope {kwargs["_id"}.')
    _id = kwargs["_id"]
    history_item = kwargs["history_item"]

    db.teleoscopes.update({"_id": kwargs["_id"]}, {'$push': {"history": kwargs["history_item"]}})

@app.task
def save_UI_state(*args, **kwargs):
    db = utils.connect()
    logging.info(f'Saving state for {kwargs["session_id"]}.')
    session_id = kwargs["session_id"]
    history_item = kwargs["history_item"]
    
    db.sessions.update({"session_id": kwargs["session_id"]}, {'$push': {"history": kwargs["history_item"]}})

@app.task
def initialize_session(*args, **kwargs):
    db = utils.connect()
    logging.info(f'Initializing sesssion for ID {kwargs["session_id"]}.')
    db.sessions.insert_one({"session_id": kwargs["session_id"], "history":[]})

'''
TODO:
1. As we move towards/away from docs, we need to keep track of which docs have been moved towards/away from
   because those docs should not be show in the ranked documents.
'''
class reorient(Task):
    
    def __init__(self):
        self.postsCached = False
        self.allPostIDs = None
        self.allPostVectors = None
        self.db = None
        self.model = None

    def cachePostsData(self, path='/home/phb/embeddings/'):
        # cache embeddings
        self.allPostVectors = np.load(path + 'embeddings.npz', allow_pickle=False)['posts']
        # cache posts ids
        with open(path + '/ids.pkl', 'rb') as handle:
                self.allPostIDs = pickle.load(handle)

        self.postsCached = True

        return
    '''
    Computes the resultant vector for positive and negative docs.
    Resultant vector is the final vector that the stateVector of the teleoscope should move towards/away from.
    '''
    def computeResultantVector(self, positive_docs, negative_docs):
        # get vectors for positive and negative doc ids using utils.getPostVector function
        # TODO: OPTIMIZE
        
        posVecs = [] # vectors we want to move towards
        for pos_id in positive_docs:
            v = utils.getPostVector(self.db, pos_id)
            posVecs.append(v)

        negVecs = [] # vectors we want to move away from
        for neg_id in negative_docs:
            v = utils.getPostVector(self.db, neg_id)
            negVecs.append(v)
        
        avgPosVec = None # avg positive vector
        avgNegVec = None # avg negative vector
        direction = 1 # direction of movement

        # handle different cases of number of docs in each list
        if len(posVecs) >= 1:
            avgPosVec = np.array(posVecs).mean(axis=0)
        if len(negVecs) >= 1:
            avgNegVec = np.array(negVecs).mean(axis=0)

        # if both lists are not empty
        if avgPosVec is not None and avgNegVec is not None:
            resultantVec = avgPosVec - avgNegVec
        # if only negative list has entries
        elif avgPosVec is None and avgNegVec is not None:
            resultantVec = avgNegVec
            # change direction of movement since we want to move away in this case
            direction = -1
        # if only positive list has entries
        elif avgPosVec is not None and avgNegVec is None:
            resultantVec = avgPosVec
        
        resultantVec /= np.linalg.norm(resultantVec)
        return resultantVec, direction

    def gridfsUpload(self, namespace, data, encoding='utf-8'):
         # convert to json
        dumps = json.dumps(data)
        fs = GridFS(self.db, namespace)
        obj = fs.put(dumps, encoding=encoding)
        return obj

    def run(self, teleoscope_id: str, positive_docs: list, negative_docs: list, query: str):
        # either positive or negative docs should have at least one entry
        if len(positive_docs) == 0 and len(negative_docs) == 0:
            # if both are empty, then cache stuff if not cached alreadt
            # Check if post ids and vectors are cached
            if self.postsCached == False:
                self.cachePostsData()

            # Check if db connection is cached
            if self.db is None:
                self.db = utils.connect()

            # do nothing since no feedback given on docs
            return

        # Check if post ids and vectors are cached
        if self.postsCached == False:
            self.cachePostsData()

        # Check if db connection is cached
        if self.db is None:
            self.db = utils.connect()

        # get query document from teleoscopes collection
        queryDocument = self.db.teleoscopes.find_one({"teleoscope_id": teleoscope_id})

        if queryDocument == None:
           querySearch(query, teleoscope_id)
           queryDocument = self.db.teleoscopes.find_one({"teleoscope_id": teleoscope_id})
           logging.info(f'queryDocument is being generated for {teleoscope_id}.')

        # check if stateVector exists
        stateVector = None
        if 'stateVector' in queryDocument:
            stateVector = np.array(queryDocument['stateVector'])
        elif self.model is None:
            self.model = utils.loadModel()
            stateVector = self.model([query]).numpy() # convert query string to vector
        else:
            stateVector = self.model([query]).numpy() # convert query string to vector

        resultantVec, direction = self.computeResultantVector(positive_docs, negative_docs)
        qprime = utils.moveVector(sourceVector=stateVector, destinationVector=resultantVec, direction=direction) # move qvector towards/away from feedbackVector
        scores = utils.calculateSimilarity(self.allPostVectors, qprime)
        newRanks = utils.rankPostsBySimilarity(self.allPostIDs, scores)
        gridfsObj = self.gridfsUpload("teleoscopes", newRanks)

        rank_slice = newRanks[0:500]
        logging.info(f'new rank slice has length {len(rank_slice)}.')

        # update stateVector
        self.db.teleoscopes.update_one({"teleoscope_id": teleoscope_id}, {'$set': { "stateVector" : qprime.tolist()}})
        # update rankedPosts
        self.db.teleoscopes.update_one({"teleoscope_id": teleoscope_id}, {'$set': { "ranked_post_ids" : gridfsObj}})
        # update a slice of rank_slice
        self.db.teleoscopes.update_one({"teleoscope_id": teleoscope_id}, {'$set': { "rank_slice" : rank_slice}})

        return 200 # TODO: what to return?

robj = app.register_task(reorient())
