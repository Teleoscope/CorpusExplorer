import datetime

def create_session_object(userid, label, color):
    return {
        "creation_time": datetime.datetime.utcnow(),
        "userlist": {
            "owner": userid,
            "contributors": []            
        },
        "history": [
            {
                "timestamp": datetime.datetime.utcnow(),
                "bookmarks": [],
                "windows": [],
                "groups": [],
                "clusters": [],
                "teleoscopes": [],
                "label": label,
                "color": color,
                "action": f"Initialize session",
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
        'textVector': textVector, 
        'text': text,
        'relationships': {
            **relationships
        },
        'metadata' : {
            **meta
        }
    }