# Hack to import parent directory modules
import os, sys
currentdir = os.path.dirname(os.path.realpath(__file__))
parentdir = os.path.dirname(currentdir)
sys.path.append(parentdir)

import utils, pytest, tasks

# ! Setup
# @pytest.fixture
# def db():
# 	db = utils.connect()
# 	yield db

# @pytest.fixture
# def session(db):
# 	"""Fixture to execute asserts before and after a test is run"""
# 	# Create a session
# 	res = db.sessions.insert_one({"username": 'test', "history":[], "teleoscopes":[]})
# 	curr_session_id = str(res.inserted_id)
# 	yield curr_session_id # this is where the testing happens
# 	# remove the session
# 	db.sessions.remove({'_id': res.inserted_id})

# @pytest.fixture
# def user(db):
# 	"""Fixture to execute asserts before and after a test is run"""
# 	# Create a user
# 	res = db.users.insert_one({"username": 'test', "password_hash": hash('test'), 'sessions': []})
# 	curr_user_id = str(res.inserted_id)
# 	yield 'test' # this is where the testing happens
# 	# Remove the user
# 	db.users.remove({'_id': res.inserted_id})


# Tests
# ! Test cases for initialize_teleoscope
# Case 1: Empty label 
def test_initialize_teleoscope_empty_label():
	assert tasks.initialize_teleoscope((), label = "") == []


# Case 2: Invalid session id - should throw an exception
def test_initialize_teleoscope_dummy_label():
	db = utils.connect()
	with pytest.raises(Exception):
		tasks.initialize_teleoscope((), label = "test label", session_id = 1010)
	# delete test label teleoscope from table
	db.teleoscopes.remove({ 'label': "test label" })


# # Case 3: Valid label, and session id
# def test_initialize_teleoscope_valid_label(db, session):
# 	try:
# 		tasks.initialize_teleoscope((), label = "test label", session_id = session)
# 	except Exception as e:
# 		pytest.fail(e)
# 	finally:
# 		db.teleoscopes.remove({ 'label': "test label" })


# Case 4: Missing kwargs
def test_initialize_session_missing_kwargs():
	with pytest.raises(Exception):
		tasks.initialize_session()


# ! Test cases for initialize_session
# Case 1: Empty username
def test_initialize_session_empty_username():
		with pytest.raises(Exception):
			tasks.initialize_session(username = "")

# Case 2: Invalid username - should throw an exception
def test_initialize_session_dummy_username():
	with pytest.raises(Exception):
		tasks.initialize_session(username = "test")

# # Case 3: Valid username - should not throw an exception
# def test_initialize_session_valid_username(db, user):
# 		try:
# 			tasks.initialize_session(username = user)
# 		except Exception as e:
# 			pytest.fail(e)
# 		finally:
# 			# Remove session
# 			db.sessions.remove({'username': 'test'})

# Case 4: Missing kwargs 
def test_initialize_session_missing_kwargs():
	with pytest.raises(Exception):
		tasks.initialize_session()

# ! Test cases for save_teleoscope_state
# Case 1: invalid teleoscope id
def test_save_teleoscope_state_invalid_teleoscope_id():
	with pytest.raises(Exception):
		tasks.save_teleoscope_state(_id = "test", history_item = [])

# Case 2: Missing kwargs - history_item
def test_save_teleoscope_state_missing_kwargs():
	with pytest.raises(Exception):
		tasks.save_teleoscope_state(_id = "test")
	
# Case 3 Missing kwargs - _id
def test_save_teleoscope_state_missing_kwargs_id():
	with pytest.raises(Exception):
		tasks.save_teleoscope_state(history_item = [])

# Case 4: Invalid teleoscope id - should throw an exception
def test_save_teleoscope_state_dummy_teleoscope_id():
	with pytest.raises(Exception):
		tasks.save_teleoscope_state(_id = "test", history_item = [])

# ! Test cases for save_UI_state
# Case 1: Invalid session id
def test_save_UI_state_invalid_session_id():
	with pytest.raises(Exception):
		tasks.save_UI_state(session_id = "test", history_item = [])

# Case 2: Missing kwargs - history_item
def test_save_UI_state_missing_kwargs():
	with pytest.raises(Exception):
		tasks.save_UI_state(session_id = "test")
	
# Case 3 Missing kwargs - session_id
def test_save_UI_state_missing_kwargs_session_id():
	with pytest.raises(Exception):
		tasks.save_UI_state(history_item = [])

