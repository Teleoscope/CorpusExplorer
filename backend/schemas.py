import datetime
from bson.objectid import ObjectId


def create_group_object(color, included_documents, label, action, user_id, description):
    obj = {
        "creation_time": datetime.datetime.utcnow(),
        "teleoscope": "deprecated",
        "history": [
            {
                "timestamp": datetime.datetime.utcnow(),
                "color": color,
                "included_documents": included_documents,
                "label": label,
                "action": action,
                "user": user_id,
                "description": description
            }]
    }
    return obj

def create_session_object(
        userid, 
        label, 
        color, 
        logical_clock=1, 
        contributors=[], 
        action=f"initialize_session",
        windows=[],
        edges=[],
        groups=[],
        clusters=[],
        teleoscopes=[],
        bookmarks=[],
        notes=[]):
    return {
        "creation_time": datetime.datetime.utcnow(),
        "userlist": {
            "owner": userid,
            "contributors": contributors
        },
        "history": [
            {
                "timestamp": datetime.datetime.utcnow(),
                "logical_clock": logical_clock,
                "bookmarks": bookmarks,
                "windows": windows,
                "edges": edges,
                "groups": groups,
                "clusters": clusters,
                "teleoscopes": teleoscopes,
                "label": label,
                "color": color,
                "action": action,
                "user": userid,
                "notes": notes
            }
        ],
    }

def create_user_object(first_name, last_name, password, username):
    return {
        "creation_time": datetime.datetime.utcnow(),
        "firstName": first_name,
        "lastName": last_name,
        "password": password,
        "username": username,
        "sessions":[],
        "action": "initialize a user"
    }

def create_document_object(title, textVector, text, relationships={}, metadata={}):
    return {
        "creation_time": datetime.datetime.utcnow(),
        'title': title, 
        'text': text,
        'textVector': textVector,
        'relationships': {
            **relationships
        },
        'metadata' : {
            **metadata
        }
    }

def create_teleoscope_history_item(
        label: str,
        reddit_ids: list,
        positive_docs: list, 
        negative_docs: list, 
        stateVector: list, 
        ranked_document_ids: ObjectId, 
        rank_slice: list,
        action: str,
        user: ObjectId):
    history_item = {
        'timestamp': datetime.datetime.utcnow(),
        'label': label,
        'reddit_ids': reddit_ids,
        'positive_docs': positive_docs,
        'negative_docs': negative_docs,
        'stateVector': stateVector,
        'ranked_document_ids': ranked_document_ids,
        'rank_slice': rank_slice,
        'action': action,
        'user': user
    }
    return history_item

def create_note_object(userid, label, content, vector):
    return {
        "creation_time": datetime.datetime.utcnow(),
        "history": [create_note_history_item(userid, label, "Add note.", content=content, vector=vector)]
    }



def create_note_history_item(userid, label, action, content={}, vector=[]):
    return {
            "user" : userid,
            "label" : label,
            "action" : action,
            "content": content,
            "vector": vector,
            "timestamp": datetime.datetime.utcnow()
    }
