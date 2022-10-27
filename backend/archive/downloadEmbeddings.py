import pickle as pkl
import utils
import numpy as np

db = utils.connect()
allPosts = utils.getAllPosts(db, projection={'id':1, 'selftextVector':1, '_id':0}, batching=True, batchSize=10000)
ids = [x['id'] for x in allPosts]
vecs = np.array([x['selftextVector'] for x in allPosts])

np.savez('~/embeddings/embeddings.npz', posts=vecs)

with open('~/embeddings/ids.pkl', 'wb') as handle:
    pkl.dump(ids, handle, protocol=pkl.HIGHEST_PROTOCOL)

print('Completed')
