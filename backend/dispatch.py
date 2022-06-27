# builtin modules
from warnings import simplefilter
import json
import random
import string

# installed modules
from celery import chain
from celery import bootsteps
from kombu import Consumer, Exchange, Queue

# local files
import auth
import tasks

from tasks import robj, app

# Thanks to http://brandonrose.org/clustering!
# and https://towardsdatascience.com/how-to-rank-text-content-by-semantic-similarity-4d2419a84c32

# ignore all future warnings
simplefilter(action='ignore', category=FutureWarning)

queue = Queue(
    auth.rabbitmq["vhost"],
    Exchange(auth.rabbitmq["vhost"]),
    auth.rabbitmq["vhost"])


def get_random_string(length):
    # choose from all lowercase letter
    letters = string.ascii_lowercase
    result_str = ''.join(random.choice(letters) for i in range(length))
    return result_str


class WebTaskConsumer(bootsteps.ConsumerStep):

    def get_consumers(self, channel):
        return [Consumer(channel,
                         queues=[queue],
                         callbacks=[self.handle_message],
                         accept=['json', 'pickle'])]

    def handle_message(self, body, message):
        print('Received message: {0!r}'.format(body))
        message.ack()
        b = json.loads(body)

        # TODO: these should exactly implement the interface standard
        # TODO: make sure they look like Stomp.js
        if b['task'] == "initialize_teleoscope":
            res = tasks.initialize_teleoscope.signature(
                args=(),
                kwargs={
                    "label": b['args']['label'],
                    "session_id": b["args"]["session_id"]
                },
            )
            res.apply_async()

        if b['task'] == "save_teleoscope_state":
            res = tasks.save_teleoscope_state.signature(
                args=(),
                kwargs={
                    "_id": b["args"]["_id"],
                    "history_item": b["args"]["history_item"]
                },
            )
            res.apply_async()

        if b['task'] == 'initialize_session':
            res = tasks.initialize_session.signature(
                args=(),
                kwargs={
                    "username": b["args"]["username"]
                },
            )
            res.apply_async()

        if b['task'] == "save_UI_state":
            res = tasks.save_UI_state.signature(
                args=(),
                kwargs={
                    "session_id": b["args"]["session_id"],
                    "history_item": b["args"]["history_item"]
                },
            )
            res.apply_async()

        if b['task'] == "reorient":
            '''
            res = robj.delay(
                teleoscope_id=b['args']["teleoscope_id"],
                positive_docs=b['args']["positive_docs"],
                negative_docs=b['args']["negative_docs"]
            )
            '''

            workflow = chain(
                robj.s(teleoscope_id=b['args']["teleoscope_id"],
                        positive_docs=b['args']["positive_docs"],
                        negative_docs=b['args']["negative_docs"]),
                tasks.save_teleoscope_state.s())

            workflow.apply_async()

        if b['task'] == "add_group":
            res = tasks.add_group.signature(
                args=(),
                kwargs={
                    "label": b["args"]["label"],
                    "color": b["args"]["color"],
                    "session_id": b["args"]["session_id"]
                }
            )
            res.apply_async()

        if b['task'] == "add_post_to_group":
            res = tasks.add_post_to_group.signature(
                args=(),
                kwargs={
                    "group_id": b["args"]["group_id"],
                    "post_id": b["args"]["post_id"]
                }
            )
            res.apply_async()

        if b['task'] == "remove_post_from_group":
            res = tasks.remove_post_from_group.signature(
                args=(),
                kwargs={
                    "group_id": b["args"]["group_id"],
                    "post_id": b["args"]["post_id"]
                }
            )
            res.apply_async()

        if b['task'] == "update_group_label":
            res = tasks.update_group_label.signature(
                args=(),
                kwargs={
                    "group_id": b["args"]["group_id"],
                    "label": b["args"]["label"]
                }
            )
            res.apply_async()

        if b['task'] == "add_note":
            res = tasks.add_note.signature(
                args=(),
                kwargs={
                    "post_id": b["args"]["post_id"],
                }
            )
            res.apply_async()

        if b['task'] == "update_note":
            res = tasks.update_note.signature(
                args=(),
                kwargs={
                    "post_id": b["args"]["post_id"],
                    "content": b["args"]["content"],
                }
            )
            res.apply_async()


app.steps['consumer'].add(WebTaskConsumer)
