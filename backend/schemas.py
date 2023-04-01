import datetime
from bson.objectid import ObjectId

def create_session_object(
        userid, 
        label, 
        color, 
        logical_clock=1, 
        contributors=[], 
        action=f"initialize_session",
        windows=[],
        groups=[],
        clusters=[],
        teleoscopes=[],
        bookmarks=[]):
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
                "groups": groups,
                "clusters": clusters,
                "teleoscopes": teleoscopes,
                "label": label,
                "color": color,
                "action": action,
                "user": userid,
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
                    