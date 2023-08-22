import datetime
import pytest
import logging
import bcrypt
from bson.objectid import ObjectId

# local files
from .. import utils
from .. import tasks
from .. import graph
from .. import projection
from .. import schemas
from . import tuning


current_time = None
db = None
user = None
workspace = None
workflow = None
documents = []
group = None
search = None

@pytest.fixture(scope="session", autouse=True)
def setup_before_tests():
    global current_time, db, user, workspace, workflow, documents, group, search
    current_time = datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S.%f")
    
    # connect to databases
    users_db = utils.connect(db="users")
    db = utils.connect(db="test")

    # add a user
    password = bcrypt.hashpw(b"password", bcrypt.gensalt(10))
    userid = tasks.register_account(password=password, username=f"test{current_time}")
    user = users_db.users.find_one(userid)

    # add a workspace which also initializes a workflow
    workspace_id = tasks.initialize_workspace(userid=userid, label=f"test{current_time}", datasource="test")
    workspace = users_db.workspaces.find_one(workspace_id)

    workflow_id = workspace["workflows"][0]
    workflow = db.sessions.find_one({"_id": workflow_id})

    # create an empty group
    groupid = tasks.add_group(
        database="test",
        userid=userid,
        workflow_id=workflow_id,
        description=f"Test group {current_time}.",
        label="Test group",
        color="#FF0000",
        documents=[]
    )
    
    # grab some arbitrary documents
    documents = list(db.documents.aggregate([{ "$sample": { "size": 3 } }]))

    for document in documents:
        tasks.add_document_to_group(
            database="test",
            userid=userid,
            group_id=groupid,
            document_id=document["_id"]
        )

    group = db.groups.find_one({"_id": groupid})

    # make a search
    searchid = tasks.add_search(
        database="test",
        userid=userid,
        workflow_id=workflow_id,
        query="helper"
    )

    search = db.searches.find_one(searchid)


###############################################################################
# Setup tests
###############################################################################

def test_db():
    global db
    assert db != None


def test_workspace():
    global workspace
    assert workspace != None


def test_workflow():
    global workflow
    assert workflow != None


def test_documents():
    assert len(documents) > 0


def test_add_group():
    global group
    assert group != None


def test_add_documents_to_group():
    global group
    assert len(group["history"][0]["included_documents"]) > 0


def test_add_search():
    global search
    assert search != None


###############################################################################
# Make node tests
###############################################################################

def test_make_node_document():
    global db, documents
    document_id = documents[0]["_id"]
    
    # make a new node from a document
    node = graph.make_node(db, workflow["_id"], document_id, "Document")
    assert node != None


def test_make_node_group():
    global db, group
    groupid = group["_id"]

    # make a new node from a group
    node = graph.make_node(db, workflow["_id"], groupid, "Group")
    assert node != None


def test_make_node_teleoscope():
    global db
    node = graph.make_node(db, workflow["_id"], None, "Teleoscope")
    assert node != None


def test_make_node_union():
    global db
    node = graph.make_node(db, workflow["_id"], None, "Union")
    assert node != None


def test_make_node_intersection():
    global db
    node = graph.make_node(db, workflow["_id"], None, "Intersection")
    assert node != None


def test_make_node_exclusion():
    global db
    node = graph.make_node(db, workflow["_id"], None, "Exclusion")
    assert node != None


def test_make_node_subtraction():
    global db
    node = graph.make_node(db, workflow["_id"], None, "Subtraction")
    assert node != None


###############################################################################
# Make edge tests
###############################################################################

def test_make_edge_from_document_to_teleoscope():
    global db, documents
    document_id = documents[0]["_id"]

    target_node = graph.make_node(db, workflow["_id"], None, "Teleoscope")
    source_node = graph.make_node(db, workflow["_id"], document_id, "Document")

    graph.make_edge(
        db=db,
        workflow_id=workflow["_id"],
        source_oid=source_node["_id"],
        source_type="Document",
        target_oid=target_node["_id"],
        target_type="Teleoscope",
        edge_type="control"
    )

    # Grab the nodes for the documents we just made
    source_node_updated = db.graph.find_one({"_id": source_node["_id"]})
    target_node_updated = db.graph.find_one({"_id": target_node["_id"]})

    logging.info(f"Target node updated {target_node_updated}.")

    # make sure the source contains a reference to the target
    updated_source_edges = source_node_updated["edges"]
    assert target_node["_id"] in [e["nodeid"] for e in updated_source_edges["output"]]
    
    # make sure the target contains a reference to the source
    updated_target_edges = target_node_updated["edges"]
    assert source_node_updated["_id"] in [e["nodeid"] for e in updated_target_edges["control"]]

    # make sure the document list is non-zero
    updated_target_docs = target_node_updated["doclists"]
    assert len(updated_target_docs) > 0


def test_make_edge_from_group_to_teleoscope():
    global db, group
    group_id = group["_id"]

    target_node = graph.make_node(db, workflow["_id"], None, "Teleoscope")
    control_node = graph.make_node(db, workflow["_id"], group_id, "Group")

    graph.make_edge(
        db=db,
        workflow_id=workflow["_id"],
        source_oid=control_node["_id"],
        source_type="Group",
        target_oid=target_node["_id"],
        target_type="Teleoscope",
        edge_type="control"
    )

    # Grab the nodes for the documents we just made
    control_node_updated = db.graph.find_one({"_id": control_node["_id"]})
    target_node_updated = db.graph.find_one({"_id": target_node["_id"]})

    logging.info(f"Target node updated {target_node_updated}.")

    # make sure the source contains a reference to the target
    updated_source_edges = control_node_updated["edges"]
    assert target_node["_id"] in [e["nodeid"] for e in updated_source_edges["output"]]
    
    # make sure the target contains a reference to the source
    updated_target_edges = target_node_updated["edges"]
    assert control_node_updated["_id"] in [e["nodeid"] for e in updated_target_edges["control"]]

    # make sure the document list is non-zero
    updated_target_docs = target_node_updated["doclists"]
    assert len(updated_target_docs) > 0

    
def test_make_edge_from_search_to_teleoscope():
    global db, search
    search_id = search["_id"]

    target_node = graph.make_node(db, workflow["_id"], None, "Teleoscope")
    source_node = graph.make_node(db, workflow["_id"], search_id, "Search")

    graph.make_edge(
        db=db, 
        workflow_id=workflow["_id"],
        source_oid=source_node["_id"],
        source_type="Search",
        target_oid=target_node["_id"],
        target_type="Teleoscope",
        edge_type="control"
    )

    # Grab the nodes for the documents we just made
    source_node_updated = db.graph.find_one({"_id": source_node["_id"]})
    target_node_updated = db.graph.find_one({"_id": target_node["_id"]})

    logging.info(f"Target node updated {target_node_updated}.")

    # make sure the source contains a reference to the target
    updated_source_edges = source_node_updated["edges"]
    assert target_node["_id"] in [e["nodeid"] for e in updated_source_edges["output"]]
    
    # make sure the target contains a reference to the source
    updated_target_edges = target_node_updated["edges"]
    assert source_node_updated["_id"] in [e["nodeid"] for e in updated_target_edges["control"]]

    # make sure the document list is non-zero
    updated_target_docs = target_node_updated["doclists"]
    assert len(updated_target_docs) > 0


def test_search_as_source_group_as_control_teleoscope():
    global db, group, search
    search_id = search["_id"]
    group_id = group["_id"]

    target_node = graph.make_node(db, workflow["_id"], None, "Teleoscope")
    source_node = graph.make_node(db, workflow["_id"], search_id, "Search")
    control_node = graph.make_node(db, workflow["_id"], group_id, "Group")

    graph.make_edge(
        db=db,
        workflow_id=workflow["_id"],
        source_oid=source_node["_id"],
        source_type="Search",
        target_oid=target_node["_id"],
        target_type="Teleoscope",
        edge_type="source"
    )

    graph.make_edge(
        db=db,
        workflow_id=workflow["_id"],
        source_oid=control_node["_id"],
        source_type="Group",
        target_oid=target_node["_id"],
        target_type="Teleoscope",
        edge_type="control"
    )

    # Grab the nodes for the documents we just made
    control_node_updated = db.graph.find_one({"_id": control_node["_id"]})
    source_node_updated = db.graph.find_one({"_id": source_node["_id"]})
    target_node_updated = db.graph.find_one({"_id": target_node["_id"]})

    # make sure the source contains a reference to the target
    updated_source_edges = source_node_updated["edges"]
    updated_control_edges = control_node_updated["edges"]
    assert target_node["_id"] in [e["nodeid"] for e in updated_source_edges["output"]]
    assert target_node["_id"] in [e["nodeid"] for e in updated_control_edges["output"]]

    # make sure the target contains a reference to the source
    updated_target_edges = target_node_updated["edges"]
    assert source_node_updated["_id"] in [e["nodeid"] for e in updated_target_edges["source"]]
    assert control_node_updated["_id"] in [e["nodeid"] for e in updated_target_edges["control"]]

    # make sure the document list is non-zero
    updated_target_docs = target_node_updated["doclists"]
    assert len(updated_target_docs) > 0


def test_search_as_source_group_as_control_reverse_order_teleoscope():
    global db, group, search
    search_id = search["_id"]
    group_id = group["_id"]

    target_node = graph.make_node(db, workflow["_id"], None, "Teleoscope")
    source_node = graph.make_node(db, workflow["_id"], search_id, "Search")
    control_node = graph.make_node(db, workflow["_id"], group_id, "Group")

    graph.make_edge(
        db=db,
        workflow_id=workflow["_id"],
        source_oid=control_node["_id"],
        source_type="Group",
        target_oid=target_node["_id"],
        target_type="Teleoscope",
        edge_type="control"
    )

    graph.make_edge(
        db=db, 
        workflow_id=workflow["_id"],
        source_oid=source_node["_id"],
        source_type="Search",
        target_oid=target_node["_id"],
        target_type="Teleoscope",
        edge_type="source"
    )

    # Grab the nodes for the documents we just made
    control_node_updated = db.graph.find_one({"_id": control_node["_id"]})
    source_node_updated = db.graph.find_one({"_id": source_node["_id"]})
    target_node_updated = db.graph.find_one({"_id": target_node["_id"]})

    # make sure the source contains a reference to the target
    updated_source_edges = source_node_updated["edges"]
    updated_control_edges = control_node_updated["edges"]
    assert target_node["_id"] in [e["nodeid"] for e in updated_source_edges["output"]]
    assert target_node["_id"] in [e["nodeid"] for e in updated_control_edges["output"]]

    # make sure the target contains a reference to the source
    updated_target_edges = target_node_updated["edges"]
    assert source_node_updated["_id"] in [e["nodeid"] for e in updated_target_edges["source"]]
    assert control_node_updated["_id"] in [e["nodeid"] for e in updated_target_edges["control"]]

    # make sure the document list is non-zero
    updated_target_docs = target_node_updated["doclists"]
    assert len(updated_target_docs) > 0


def test_search_as_source_group_and_documents_as_control_reverse_order_teleoscope():
    global db, documents, group, search
    search_id = search["_id"]
    group_id = group["_id"]

    target_node = graph.make_node(db, workflow["_id"], None, "Teleoscope")
    control_node = graph.make_node(db, workflow["_id"], group_id, "Group")
    source_node = graph.make_node(db, workflow["_id"], search_id, "Search")

    doc_nodes = []

    for document in documents:
        doc_node = graph.make_node(db, workflow["_id"], document["_id"], "Document")
        doc_nodes.append(doc_node)
        graph.make_edge(
            db=db,
            workflow_id=workflow["_id"],
            source_oid=doc_node["_id"],
            source_type="Document",
            target_oid=target_node["_id"],
            target_type="Teleoscope",
            edge_type="control"
        )

    graph.make_edge(
        db=db,
        workflow_id=workflow["_id"],
        source_oid=control_node["_id"],
        source_type="Group",
        target_oid=target_node["_id"],
        target_type="Teleoscope",
        edge_type="control"
    )

    graph.make_edge(
        db=db,
        workflow_id=workflow["_id"],
        source_oid=source_node["_id"],
        source_type="Search",
        target_oid=target_node["_id"],
        target_type="Teleoscope",
        edge_type="source"
    )

    # Grab the nodes for the documents we just made
    control_node_updated = db.graph.find_one({"_id": control_node["_id"]})
    source_node_updated = db.graph.find_one({"_id": source_node["_id"]})
    target_node_updated = db.graph.find_one({"_id": target_node["_id"]})

    # make sure the source contains a reference to the target
    updated_source_edges = source_node_updated["edges"]
    updated_control_edges = control_node_updated["edges"]
    assert target_node["_id"] in [e["nodeid"] for e in updated_source_edges["output"]]
    assert target_node["_id"] in [e["nodeid"] for e in updated_control_edges["output"]]

    # make sure the target contains a reference to the source
    updated_target_edges = target_node_updated["edges"]
    assert source_node_updated["_id"] in [e["nodeid"] for e in updated_target_edges["source"]]
    assert control_node_updated["_id"] in [e["nodeid"] for e in updated_target_edges["control"]]

    # make sure the document list is non-zero
    updated_target_docs = target_node_updated["doclists"]
    assert len(updated_target_docs) > 0

def test_make_edge_from_group_to_projection():
    global db, group
    group_id = group["_id"]

    target_node = graph.make_node(db, workflow["_id"], None, "Projection")
    control_node = graph.make_node(db, workflow["_id"], group_id, "Group")

    graph.make_edge(
        db=db,
        workflow_id=workflow["_id"],
        source_oid=control_node["_id"],
        source_type="Group",
        target_oid=target_node["_id"],
        target_type="Projection",
        edge_type="control"
    )

    # Grab the nodes for the documents we just made
    control_node_updated = db.graph.find_one({"_id": control_node["_id"]})
    target_node_updated = db.graph.find_one({"_id": target_node["_id"]})

    logging.info(f"Target node updated {target_node_updated}.")

    # make sure the source contains a reference to the target
    updated_source_edges = control_node_updated["edges"]
    assert target_node["_id"] in [e["nodeid"] for e in updated_source_edges["output"]]
    
    # make sure the target contains a reference to the source
    updated_target_edges = target_node_updated["edges"]
    assert control_node_updated["_id"] in [e["nodeid"] for e in updated_target_edges["control"]]

    # make sure the document list is non-zero
    updated_target_docs = target_node_updated["doclists"]
    assert len(updated_target_docs) > 0

def test_make_edge_from_group_and_document_to_projection():
    global db, group
    group_id = group["_id"]
    document_id = documents[0]["_id"]

    target_node = graph.make_node(db, workflow["_id"], None, "Projection")
    params = {
        "ordering": "random",
        "separation": True,
    }
    graph.update_parameters(db=db, node=target_node, parameters=params)

    control_node = graph.make_node(db, workflow["_id"], group_id, "Group")
    doc_control_node = graph.make_node(db, workflow["_id"], document_id, "Document")

    graph.make_edge(
        db=db,
        workflow_id=workflow["_id"],
        source_oid=control_node["_id"],
        source_type="Group",
        target_oid=target_node["_id"],
        target_type="Projection",
        edge_type="control"
    )

    graph.make_edge(
        db=db,
        workflow_id=workflow["_id"],
        source_oid=doc_control_node["_id"],
        source_type="Document",
        target_oid=target_node["_id"],
        target_type="Projection",
        edge_type="control"
    )


    # Grab the nodes for the documents we just made
    control_updated = db.graph.find_one({"_id": control_node["_id"]})
    target_node_updated = db.graph.find_one({"_id": target_node["_id"]})

    logging.info(f"Target node updated {target_node_updated}.")

    # make sure the source contains a reference to the target
    updated_source_edges = control_updated["edges"]
    assert target_node["_id"] in [e["nodeid"] for e in updated_source_edges["output"]]
    
    # make sure the target contains a reference to the source
    updated_target_edges = target_node_updated["edges"]
    assert control_updated["_id"] in [e["nodeid"] for e in updated_target_edges["control"]]

    # make sure the document list is non-zero
    updated_target_docs = target_node_updated["doclists"]
    assert len(updated_target_docs) > 0

def test_search_as_source_group_as_control_projection():
    global db, group, search
    search_id = search["_id"]
    group_id = group["_id"]

    target_node = graph.make_node(db, workflow["_id"], None, "Projection")
    control_node = graph.make_node(db, workflow["_id"], group_id, "Group")
    source_node = graph.make_node(db, workflow["_id"], search_id, "Search")

    graph.make_edge(
        db=db,
        workflow_id=workflow["_id"],
        source_oid=control_node["_id"],
        source_type="Group",
        target_oid=target_node["_id"],
        target_type="Projection",
        edge_type="control"
    )

    graph.make_edge(
        db=db,
        workflow_id=workflow["_id"],
        source_oid=source_node["_id"],
        source_type="Search",
        target_oid=target_node["_id"],
        target_type="Projection",
        edge_type="source"
    )

    # Grab the nodes for the documents we just made
    control_node_updated = db.graph.find_one({"_id": control_node["_id"]})
    source_node_updated = db.graph.find_one({"_id": source_node["_id"]})
    target_node_updated = db.graph.find_one(target_node["_id"])

    # make sure the source contains a reference to the target
    updated_source_edges = source_node_updated["edges"]
    updated_control_edges = control_node_updated["edges"]
    assert target_node["_id"] in [e["nodeid"] for e in updated_source_edges["output"]]
    assert target_node["_id"] in [e["nodeid"] for e in updated_control_edges["output"]]

    # make sure the target contains a reference to the source
    updated_target_edges = target_node_updated["edges"]
    assert source_node_updated["_id"] in [e["nodeid"] for e in updated_target_edges["source"]]
    assert control_node_updated["_id"] in [e["nodeid"] for e in updated_target_edges["control"]]

    # make sure the document list is non-zero
    updated_target_docs = target_node_updated["doclists"]
    assert len(updated_target_docs) > 0

###############################################################################
# Remove edge tests
###############################################################################

def test_make_and_remove_edge_from_document_to_teleoscope():
    global db, documents
    document_id = documents[0]["_id"]

    target_node = graph.make_node(db, workflow["_id"], None, "Teleoscope")
    control_node = graph.make_node(db, workflow["_id"], document_id, "Document")

    graph.make_edge(
        db=db,
        workflow_id=workflow["_id"],
        source_oid=control_node["_id"],
        source_type="Document",
        target_oid=target_node["_id"],
        target_type="Teleoscope",
        edge_type="control"
    )

    # Grab the nodes for the documents we just made
    control_node_updated = db.graph.find_one({"_id": control_node["_id"]})
    target_node_updated = db.graph.find_one({"_id": target_node["_id"]})

    logging.info(f"Target node updated {target_node_updated}.")

    # make sure the source contains a reference to the target
    updated_source_edges = control_node_updated["edges"]
    assert target_node["_id"] in [e["nodeid"] for e in updated_source_edges["output"]]
    
    # make sure the target contains a reference to the source
    updated_target_edges = target_node_updated["edges"]
    assert control_node_updated["_id"] in [e["nodeid"] for e in updated_target_edges["control"]]

    # make sure the document list is non-zero
    updated_target_docs = target_node_updated["doclists"]
    assert len(updated_target_docs) > 0


    # Remove the edge
    tasks.remove_edge(
        database="test", 
        userid=user["_id"], 
        workflow_id=workflow["_id"], 
        edge={
            "source": f"{control_node['_id']}%12345%Document",
            "target": f"{target_node['_id']}%12345%Teleoscope",
            "targetHandle": f"randomstuff1234_control"
        }
    )

    # Grab the nodes for the documents we just made
    control_node_updated = db.graph.find_one({"_id": control_node["_id"]})
    target_node_updated = db.graph.find_one({"_id": target_node["_id"]})

    # make sure the source contains a reference to the target
    updated_source_edges = control_node_updated["edges"]
    assert target_node["_id"] not in [e["nodeid"] for e in updated_source_edges["output"]]
    
    # make sure the target contains a reference to the source
    updated_target_edges = target_node_updated["edges"]
    assert control_node_updated["_id"] not in [e["nodeid"] for e in updated_target_edges["control"]]

    # make sure the document list is zero
    updated_target_docs = target_node_updated["doclists"]
    assert len(updated_target_docs) == 0


def test_make_and_remove_multiple_edges_from_document_to_teleoscope():
    global db, documents
    
    target_node = graph.make_node(db, workflow["_id"], None, "Teleoscope")
    control_nodes = []

    for document in documents:
        document_id = document["_id"]

        control_node = graph.make_node(db, workflow["_id"], document_id, "Document")
        control_nodes.append(control_node)

        graph.make_edge(
            db=db,
            workflow_id=workflow["_id"],
            source_oid=control_node["_id"],
            source_type="Document",
            target_oid=target_node["_id"],
            target_type="Teleoscope",
            edge_type="control"
        )
    
    # Remove the 1st edge
    tasks.remove_edge(
        database="test", 
        userid=user["_id"], 
        workflow_id=workflow["_id"],
        edge={
            "source": f"{control_nodes[0]['_id']}%12345%Document",
            "target": f"{target_node['_id']}%12345%Teleoscope",
            "targetHandle": f"randomstuff1234_control"
        }
    )

    # Grab the nodes for the documents we just made
    control_node_updated = db.graph.find_one({"_id": control_nodes[0]["_id"]})
    target_node_updated = db.graph.find_one({"_id": target_node["_id"]})

    # make sure the source contains a reference to the target
    updated_source_edges = control_node_updated["edges"]
    assert target_node["_id"] not in [e["nodeid"] for e in updated_source_edges["output"]]
    
    # make sure the target contains a reference to the source
    updated_target_edges = target_node_updated["edges"]
    assert control_node_updated["_id"] not in [e["nodeid"] for e in updated_target_edges["control"]]

    # make sure the document list is non-zero
    updated_target_docs = target_node_updated["doclists"]
    assert len(updated_target_docs) == 1


    # Remove the 2nd edge
    tasks.remove_edge(
        database="test", 
        userid=user["_id"], 
        workflow_id=workflow["_id"],
        edge={
            "source": f"{control_nodes[1]['_id']}%12345%Document",
            "target": f"{target_node['_id']}%12345%Teleoscope",
            "targetHandle": f"randomstuff1234_control"
        }
    )

    # Grab the nodes for the documents we just made
    control_node_updated = db.graph.find_one({"_id": control_nodes[0]["_id"]})
    target_node_updated = db.graph.find_one({"_id": target_node["_id"]})

    # make sure the source contains a reference to the target
    updated_source_edges = control_node_updated["edges"]
    assert target_node["_id"] not in [e["nodeid"] for e in updated_source_edges["output"]]
    
    # make sure the target contains a reference to the source
    updated_target_edges = target_node_updated["edges"]
    assert control_node_updated["_id"] not in [e["nodeid"] for e in updated_target_edges["control"]]

    # make sure the document list is non-zero
    updated_target_docs = target_node_updated["doclists"]
    assert len(updated_target_docs) == 1


    # Remove the 3rd edge
    tasks.remove_edge(
        database="test", 
        userid=user["_id"], 
        workflow_id=workflow["_id"],
        edge={
            "source": f"{control_nodes[2]['_id']}%12345%Document",
            "target": f"{target_node['_id']}%12345%Teleoscope",
            "targetHandle": f"randomstuff1234_control"
        }
    )

    # Grab the nodes for the documents we just made
    control_node_updated = db.graph.find_one({"_id": control_nodes[0]["_id"]})
    target_node_updated = db.graph.find_one({"_id": target_node["_id"]})

    # make sure the source contains a reference to the target
    updated_source_edges = control_node_updated["edges"]
    assert target_node["_id"] not in [e["nodeid"] for e in updated_source_edges["output"]]
    
    # make sure the target contains a reference to the source
    updated_target_edges = target_node_updated["edges"]
    assert control_node_updated["_id"] not in [e["nodeid"] for e in updated_target_edges["control"]]

    # make sure the document list is non-zero
    updated_target_docs = target_node_updated["doclists"]
    assert len(updated_target_docs) == 0
  

def test_model():


    """
        Super set hyperparameter testing.

        To run single test with logging info
            > pytest test_graph.py::test_model --log-cli-level=INFO

        
    """

    db = utils.connect(db="nursing")
    
    sources = []
    controls = []
    ids = [
        "6452ffcaa192f6224493e419", # race/culture
        "6488b6ebde56ae65c7cfe67e", # 2SLGBTQ+ 
        "6452ffe1a192f6224493e41f", # vulnerable
        "64545bf9ae13c83727e4fb4a", # disabilities
        "6452ffd6a192f6224493e41d", # mental health
    ]

    for id in ids:
        group = db.groups.find_one({"_id": ObjectId(str(id))})
        edge = schemas.create_edge(group["_id"], group["_id"], "Group")
        controls.append(edge)

    project = tuning.Tuning(db, sources, controls)
    project.tuning()
