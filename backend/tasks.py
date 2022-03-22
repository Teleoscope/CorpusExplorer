# builtin modules
import logging
import pickle
from warnings import simplefilter
import utils

# installed modules
import gridfs
from gridfs import GridFS
import json

import numpy as np
import tensorflow_hub as hub
from celery import Celery, Task

# local files
import auth

import time

# ignore all future warnings
simplefilter(action='ignore', category=FutureWarning)

# url: "amqp://myuser:mypassword@localhost:5672/myvhost"
celery_broker_url = (
    f'amqp://'
    f'{auth.rabbitmq["username"]}:'
    f'{auth.rabbitmq["password"]}@'
    f'{auth.rabbitmq["host"]}/'
    f'{auth.rabbitmq["vhost"]}'
)

app = Celery('tasks', backend='rpc://', broker=celery_broker_url)
app.conf.update(
    task_serializer='pickle',
    accept_content=['pickle'],  # Ignore other content
    result_serializer='pickle',
)

'''
querySearch:
Performs a text query on aita.clean.posts.v2 text index.
If the query string alredy exists in the queries collection, returns existing reddit_ids.
Otherwise, adds the query to the queries collection and performs a text query the results of which are added to the
queries collection and returned.

TODO: 
1. We can use GridFS to store the results of the query if needed (if sizeof(reddit_ids) > 16MB).
   Doesnt seem to be an issue right now.
2. Checks for both teleoscope_id and query. Need confirmation from frontend on whether the teleoscope_id and/or query will already exist?
   If not, then who updates them?
'''
@app.task
def querySearch(query_string, teleoscope_id):
    db = utils.connect()
    query_results = db.queries.find_one({"query": query_string, "teleoscope_id": teleoscope_id})
    
    # check if query already exists
    if query_results is not None:
        logging.info(f"query {query_string} already exists in queries collection")
        return query_results['reddit_ids']

    # create a new query document
    db.queries.insert_one({"query": query_string, "teleoscope_id": teleoscope_id})

    # perform text search query
    textSearchQuery = {"$text": {"$search": query_string}}
    cursor = db.clean.posts.v2.find(textSearchQuery, projection = {'id':1})
    return_ids = [x['id'] for x in cursor]

    # store results in queries collection
    db.queries.update_one({'query': query_string, 'teleoscope_id': teleoscope_id}, {'$set': {'reddit_ids': return_ids}})
    
    logging.info(f"query {query_string} added to queries collection")
    return return_ids


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
        

    def run(self, teleoscope_id: str, positive_docs: list, negative_docs: list, query: str):
        if self.postsCached == False:
            # Load embeddings
            self.allPostVectors = np.load('/home/phb/embeddings/embeddings.npz', allow_pickle=False)['posts']
            # Load ids
            with open('/home/phb/embeddings/ids.pkl', 'rb') as handle:
                self.allPostIDs = pickle.load(handle)

            self.postsCached = True

        if self.db is None:
            self.db = utils.connect()

        queryDocument = self.db.queries.find_one({"query": query, "teleoscope_id": teleoscope_id})

        # check if stateVector exists
        if 'stateVector' in queryDocument:
            stateVector = np.array(queryDocument['stateVector'])
        else:
            if self.model is None:
                self.model = utils.loadModel()

            stateVector = self.model([query]).numpy() # convert query string to vector

        # get vectors for positive and negative doc ids using utils.getPostVector function
        # TODO: OPTIMIZE
        posVecs = []
        for pos_id in positive_docs:
            v = utils.getPostVector(self.db, pos_id)
            posVecs.append(v)

        negVecs = []
        for neg_id in negative_docs:
            v = utils.getPostVector(self.db, neg_id) # need -1??
            negVecs.append(v)
        
        avgPosVec = None
        avgNegVec = None
        direction = 1

        # handle different cases of number of docs in each list
        if len(posVecs) >= 1:
            avgPosVec = np.array(posVecs).mean(axis=0)
        if len(negVecs) >= 1:
            avgNegVec = np.array(negVecs).mean(axis=0)

        if avgPosVec is not None and avgNegVec is not None:
            resultantVec = avgPosVec - avgNegVec
        elif avgPosVec is None and avgNegVec is not None:
            resultantVec = avgNegVec
            direction = -1
        elif avgPosVec is not None and avgNegVec is None:
            resultantVec = avgPosVec

        # make unit vector
        resultantVec = resultantVec / np.linalg.norm(resultantVec)
        qprime = utils.moveVector(sourceVector=stateVector, destinationVector=resultantVec, direction=direction) # move qvector towards/away from feedbackVector

        scores = utils.calculateSimilarity(self.allPostVectors, qprime)
        newRanks = utils.rankPostsBySimilarity(self.allPostIDs, scores)

        # convert to json to upload to gridfs
        dumps = json.dumps(newRanks)
        # upload to gridfs
        fs = GridFS(self.db, "queries")
        obj = fs.put(dumps, encoding='utf-8')

        # update stateVector
        self.db.queries.update_one({"query": query, "teleoscope_id": teleoscope_id}, {'$set': { "stateVector" : qprime.tolist()}})
        # update rankedPosts
        self.db.queries.update_one({"query": query, "teleoscope_id": teleoscope_id}, {'$set': { "ranked_post_ids" : obj}})

        return 200 # TODO: what to return?

robj = app.register_task(reorient())
