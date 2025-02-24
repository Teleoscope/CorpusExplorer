# graph.py
from bson.objectid import ObjectId
from pymongo import database
from typing import List
import numpy as np
import logging
import json

import os
import uuid
from celery import Celery
from kombu import Exchange, Queue

# package files
from backend import embeddings
from backend import utils
from backend import projection

# environment variables
from dotenv import load_dotenv

load_dotenv()  # This loads the variables from .env


# RabbitMQ connection details
RABBITMQ_USERNAME = os.getenv("RABBITMQ_USERNAME")
RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD")
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST")
RABBITMQ_PORT = os.getenv("RABBITMQ_PORT")
RABBITMQ_VHOST = os.getenv("RABBITMQ_VHOST")
RABBITMQ_TASK_QUEUE = os.getenv("RABBITMQ_TASK_QUEUE")
RABBITMQ_VECTORIZE_QUEUE = os.getenv("RABBITMQ_VECTORIZE_QUEUE")
RABBITMQ_UPLOAD_VECTOR_QUEUE = os.getenv("RABBITMQ_UPLOAD_VECTOR_QUEUE")

if not RABBITMQ_USERNAME:
    logging.info("Missing environment variable RABBITMQ_USERNAME")
if not RABBITMQ_PASSWORD:
    logging.info("Missing environment variable RABBITMQ_PASSWORD")
if not RABBITMQ_HOST:
    logging.info("Missing environment variable RABBITMQ_HOST")
if not RABBITMQ_PORT:
    logging.info("Missing environment variable RABBITMQ_PORT")
if not RABBITMQ_VHOST:
    logging.info("Missing environment variable RABBITMQ_VHOST")
if not RABBITMQ_TASK_QUEUE:
    logging.info("Missing environment variable RABBITMQ_TASK_QUEUE")
if not RABBITMQ_VECTORIZE_QUEUE:
    logging.info("Missing environment variable RABBITMQ_VECTORIZE_QUEUE")
if not RABBITMQ_UPLOAD_VECTOR_QUEUE:
    logging.info("Missing environment variable RABBITMQ_UPLOAD_VECTOR_QUEUE")

# Broker URL for Celery
CELERY_BROKER_URL = (
    f"amqp://"
    f"{RABBITMQ_USERNAME}:"
    f"{RABBITMQ_PASSWORD}@"
    f"{RABBITMQ_HOST}:{RABBITMQ_PORT}/"
    f"{RABBITMQ_VHOST}"
)

# Queue and Celery app setup
queue = Queue("graph", Exchange("graph"), "graph")
app = Celery("backend.graph", backend="rpc://", broker=CELERY_BROKER_URL)

app.conf.update(
    task_serializer="pickle",
    accept_content=["pickle", "json"],  # Ignore other content
    result_serializer="pickle",
    task_queues=[queue],
    worker_concurrency=1,
)

################################################################################
# Tasks to register
################################################################################
@app.task
def update_nodes(*args, database: str, node_uids: List[str], workspace_id: str, **kwargs):
    logging.info(f"Updating {len(node_uids)} nodes.")
    db = utils.connect(db=database)
    for node_uid in node_uids:
        graph_uid(db, workspace_id, node_uid)
    return


@app.task
def milvus_chunk_import(database: str, workspace: str, userid: str, documents):
    logging.info(f"Recieved an import chunk of length {len(documents)} for database {database}.")
    mongo_db = utils.connect(db=database)
    docs = mongo_db.documents.find(
        {"_id": {"$in": [ObjectId(str(d)) for d in documents]}}
    )
    send_documents_for_processing(list(docs), workspace, database)
    logging.info(f"Sending import chunk of length {len(documents)} for database {database} to be vectorized.")
    return


@app.task
def update_vectors(database: str, documents):
    logging.info(f"Updating {len(documents)} vectors in database {database}...")
    send_documents_for_processing(documents, database)
    logging.info(f"Sending an update for {len(documents)} vectors in database {database}.")
    return


@app.task
def delete_vectors(database: str, ids):
    logging.info(f"Deleting {len(ids)} vectors in database {database}...")
    client = embeddings.connect()
    client.delete(collection_name=database, ids=ids)
    logging.info(f"Deleted {len(ids)} vectors in database {database}.")


################################################################################
# Model functions
################################################################################
def send_documents_for_processing(documents, workspace_id, database):
    # Prepare the payload as a list of dictionaries
    formatted_documents = [{'id': str(doc["_id"]), 'text': doc["text"]} for doc in documents]

    # Send the request directly with the list of documents
    body = {
        "documents": formatted_documents,
        "workspace_id":  str(workspace_id),
        "database": database
    }
    utils.publish(RABBITMQ_VECTORIZE_QUEUE, json.dumps(body))
    logging.info(f"Requesting vectorization of {len(formatted_documents)} documents.")
    return
        
################################################################################
# Graph API
################################################################################
def graph_uid(db, workspace_id, uid):
    db.graph.update_one({"uid": uid}, {"$set": {"doclists": []}})
    node = db.graph.find_one({"uid": uid})
    if not node:
        logging.info(f"No node found for {uid}.")
        return
    else:
        logging.info(f"Updating node {uid} with type {node['type']}.")

    sources = node["edges"]["source"]
    controls = node["edges"]["control"]
    outputs = node["edges"]["output"]

    parameters = node["parameters"]
    node_type = node["type"]

    match node_type:
        case "Document":
            node = update_document(db, node, parameters)
        case "Group":
            node = update_group(db, node, parameters)
        case "Storage":
            node = update_storage(db, node, parameters)
        case "Search":
            node = update_search(db, node, parameters)
        case "Note":
            node = update_note(db, node, parameters)
        case "Rank":
            node = update_rank(db, node, sources, controls, parameters, workspace_id)
        case "Projection":
            node = update_projection(db, node, sources, controls, parameters, workspace_id)
        case "Union":
            node = update_union(db, node, sources, controls, parameters)
        case "Intersection":
            node = update_intersection(db, node, sources, controls, parameters)
        case "Exclusion":
            node = update_exclusion(db, node, sources, controls, parameters)
        case "Difference":
            node = update_difference(db, node, sources, controls, parameters)
        case "Filter":
            node = update_filter(db, node, sources, controls, parameters)

    res = db.graph.replace_one({"uid": uid}, node)

    # Calculate each node downstream to the right.
    for edge_uid in outputs:
        graph_uid(db, workspace_id, edge_uid)

    return res


################################################################################
# Update Document
################################################################################
def update_document(db: database.Database, document_node, parameters):
    document_id = ObjectId(str(document_node["reference"]))
    doclist = {
        "reference": document_id,
        "uid": document_node["uid"],
        "type": document_node["type"],
        "ranked_documents": [(document_id, 1.0)],
    }
    document_node["doclists"] = [doclist]
    return document_node


################################################################################
# Update Group
################################################################################
def update_group(db: database.Database, group_node, parameters):
    group_id = ObjectId(str(group_node["reference"]))
    group = db.groups.find_one(group_id)
    documents = group["docs"]

    doclist = {
        "reference": group_id,
        "uid": group_node["uid"],
        "type": group_node["type"],
        "ranked_documents": [(d, 1.0) for d in documents],
    }
    group_node["doclists"] = [doclist]
    return group_node


################################################################################
# Update Storage
################################################################################
def update_storage(db: database.Database, storage_node, parameters):
    storage_id = ObjectId(str(storage_node["reference"]))
    storage = db.storage.find_one(storage_id)
    documents = storage["docs"]

    doclist = {
        "reference": storage_id,
        "uid": storage_node["uid"],
        "type": storage_node["type"],
        "ranked_documents": [(d, 1.0) for d in documents],
    }
    storage_node["doclists"] = [doclist]
    return storage_node


################################################################################
# Update Note
################################################################################
def update_note(db: database.Database, note_node, parameters):
    note_id = ObjectId(str(note_node["reference"]))
    note = db.notes.find_one(note_id)
    documents = []

    doclist = {
        "reference": note_id,
        "uid": note_node["uid"],
        "type": note_node["type"],
        "ranked_documents": [],
    }

    note_node["doclists"] = [doclist]
    return note_node


################################################################################
# Update Search
################################################################################
def update_search(db: database.Database, search_node, parameters):
    search_id = ObjectId(str(search_node["reference"]))
    search = db.searches.find_one(search_id)
    documents = list(
        db.documents.find(
            utils.make_query(search["query"]), {"projection": {"_id": 1}}
        ).limit(1000)
    )
    doclist = {
        "reference": search_id,
        "uid": search_node["uid"],
        "type": search_node["type"],
        "ranked_documents": [(d["_id"], 1.0) for d in documents],
    }
    search_node["doclists"] = [doclist]
    return search_node


################################################################################
# Update Rank
################################################################################
def update_rank(
    mdb: database.Database, rank_node, sources: List, controls: List, parameters, 
    workspace_id ):
    # check if it's worth updating the node
    if len(controls) == 0:
        rank_node["status"] = "No controls included."
        logging.info(f"No controls included. Returning original teleoscope node.")
        return rank_node

    # collection name should be something unique
    collection_name = mdb.name

    # connect to Milvus
    client = embeddings.connect()

    # get every document oid from the control nodes
    control_oids = utils.get_doc_oids(mdb, controls, exclude=[])
    logging.info(f"Documents with oids {control_oids} found for controls {controls}.")

    # get the vectors for each document vector id
    milvus_results = embeddings.get_embeddings(client, collection_name, workspace_id, control_oids)

    # unpack results
    control_vectors = [np.array(res["vector"]) for res in milvus_results]
    logging.info(
        f"Found {len(control_vectors)} vectors for {len(control_oids)} controls."
    )

    if len(control_vectors) == 0:
        logging.info(f"No control vectors found.")
        rank_node["status"] = "No embeddings found."
        return rank_node

    # average the control vectors to create a rank search vector
    search_vector = np.average(control_vectors, axis=0)
    logging.info(f"Search vector shape is {search_vector.shape}.")

    if np.isnan(search_vector).any():
        logging.info(f"Search vector has an entry that isn't a number: {search_vector}.")
        rank_node["status"] = "Invalid search vector."
        return rank_node

    # set the distance from the search vector that we care to look
    distance = 0.5
    if "distance" in parameters:
        distance = parameters["distance"]

    # get the index to search over
    index = client.describe_index(
        collection_name=collection_name, index_name="vector_index", field_name="vector"
    )

    # set up parameters for the vector search
    search_params = {
        # use `IP` as the metric to calculate the distance
        # needs to match the index in the collection
        "metric_type": index["metric_type"],
        "params": {
            # search for vectors with a distance greater than 0.8
            "radius": 1 - distance,
            # filter out most similar vectors with a distance greater than or equal to 1.0
            "range_filter": (1 - distance) + 1.0,
        },
    }

    # doclists to append to the graph node
    source_map = []
    doclists = []

    # search defaults to the whole corpus
    if len(sources) == 0:
        logging.info(f"No sources found, performing search.")
        # Get results within radius
        results = client.search(
            collection_name=collection_name,
            data=[search_vector],
            anns_field="vector",
            search_params=search_params,
            limit=10000,
            partition_names=[str(workspace_id)]
        )

        ranks = [(result["id"], float(result["distance"])) for result in results[0]]
        doclists.append(
            {"reference": None, "uid": None, "ranked_documents": ranks, "type": "All"}
        )

    else:
        logging.info(f"{len(sources)} sources found, retrieving from database.")
        source_nodes = list(mdb.graph.find({"uid": {"$in": sources}}))
        logging.info(f"Finding vectors for {len(source_nodes)} sources found.")
        for source in source_nodes:
            oids = utils.get_oids(mdb, source)
            if oids:
                # results look like:
                # [  { "vector": [ ... ], "id": 'oid0128409128394' }, ..., { ... }  ]
                results = client.get(
                    collection_name=collection_name, 
                    ids=oids, 
                    output_fields=["vector"],
                    partition_names=[str(workspace_id)]
                )
                logging.info(f"{len(results)} result vectors found.")
                source_map.append((source, oids, [r["vector"] for r in results]))

        for source, source_oids, source_vecs in source_map:
            logging.info(f"Ranking {len(source_map)} sources.")
            ranks = utils.rank(control_vectors, source_oids, source_vecs)
            doclists.append(
                {
                    "type": source["type"],
                    "uid": source["uid"],
                    "reference": source["reference"],
                    "ranked_documents": ranks,
                }
            )

    rank_node["status"] = "Rank complete."
    rank_node["doclists"] = doclists

    client.close()

    return rank_node

################################################################################
# Update Projection
################################################################################
def update_projection(
    db: database.Database, projection_node, sources: List, controls: List, parameters, workspace_id: str
):
    if len(sources) == 0:
        logging.info(f"No sources included. Returning original projection node.")
        return projection_node

    source_graph_items = list(db.graph.find({"uid": {"$in": sources}}))
    control_graph_items = list(db.graph.find({"uid": {"$in": controls}}))

    logging.info(f"Updating Projection id: {projection_node['_id']}")

    # ordering = parameters["ordering"]
    # separation = parameters["separation"]

    # logging.info(f"Running with {ordering} ordering and seperation = {separation}")
    ordering = None
    separation = None
 
    doclists = projection.document_ordering(source_graph_items, control_graph_items, db.name, workspace_id)
    projection_node["doclists"] = doclists

    return projection_node


################################################################################
# Update Boolean Operations
################################################################################
def update_boolean_doclists(db, sources: List, controls: List, operation):
    doclists = []
    source_lists = []
    control_oids = []

    source_nodes = list(db.graph.find({"uid": {"$in": sources}}))
    control_nodes = list(db.graph.find({"uid": {"$in": controls}}))

    logging.info(
        f"Found {len(source_nodes)} source nodes and {len(control_nodes)} control nodes."
    )

    for control in control_nodes:
        control_oids.extend(utils.get_oids(db, control))

    for source in source_nodes:
        oids = utils.get_oids(db, source)
        source_lists.append((source, operation(oids, control_oids)))

    for source, source_oids in source_lists:
        ranks = [(oid, 1.0) for oid in source_oids]
        doclists.append(
            {
                "type": source["type"],
                "uid": source["uid"],
                "reference": source["reference"],
                "ranked_documents": ranks,
            }
        )
    return doclists


def update_difference(db, node, sources: List, controls: List, parameters):
    def difference(current_oids, control_oids):
        curr = set(current_oids)
        ctrl = set(control_oids)
        return list(curr.difference(ctrl))

    doclists = update_boolean_doclists(db, sources, controls, difference)

    node["doclists"] = doclists
    return node


def update_union(db, node, sources: List, controls: List, parameters):
    def union(current_oids, control_oids):
        curr = set(current_oids)
        ctrl = set(control_oids)
        return list(curr.union(ctrl))

    doclists = update_boolean_doclists(db, sources, controls, union)

    node["doclists"] = doclists
    return node


def update_intersection(db, node, sources: List, controls: List, parameters):
    def intersection(current_oids, control_oids):
        curr = set(current_oids)
        ctrl = set(control_oids)
        return list(curr.intersection(ctrl))

    doclists = update_boolean_doclists(db, sources, controls, intersection)

    node["doclists"] = doclists
    return node


def update_exclusion(db, node, sources: List, controls: List, parameters):
    def exclusion(current_oids, control_oids):
        curr = set(current_oids)
        ctrl = set(control_oids)
        diff_curr = curr.difference(ctrl)
        diff_ctrl = ctrl.difference(curr)
        return list(diff_curr.union(diff_ctrl))

    doclists = update_boolean_doclists(db, sources, controls, exclusion)

    node["doclists"] = doclists
    return node


def update_filter(db, node, sources: List, controls: List, parameters):
    return node  # stub


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,  # Set the desired log level
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(),  # Logs to console
            # Add more handlers here if needed, like FileHandler for logging to files
        ],
    )

def start_worker():
    worker = app.Worker(
        include=["backend.graph"],
        hostname=f"graph.{os.getenv('USER')}@%h{uuid.uuid4()}",
        loglevel="INFO",
    )
    worker.start()
    (
        [
            "worker",
            "--loglevel=INFO",
            f"--hostname=graph.{os.getenv('USER')}@%h{uuid.uuid4()}",
        ]
    )

def main():
    setup_logging()
    start_worker()
    


################################################################################
# Main for Celery worker
################################################################################
if __name__ == "__main__":
    main()
    
