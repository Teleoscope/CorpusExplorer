# builtin modules
import logging
import pickle
from warnings import simplefilter
import utils
import json
import random
import string



# installed modules
import gridfs
import numpy as np
import tensorflow_hub as hub
from celery import Celery
from celery import bootsteps
from kombu import Consumer, Exchange, Queue

# local files
import auth
import tasks

# Thanks to http://brandonrose.org/clustering!
# and https://towardsdatascience.com/how-to-rank-text-content-by-semantic-similarity-4d2419a84c32

# ignore all future warnings
simplefilter(action='ignore', category=FutureWarning)

systopia = Queue('systopia', Exchange('systopia'), 'systopia')

from tasks import robj, app

class WebTaskConsumer(bootsteps.ConsumerStep):

    def get_consumers(self, channel):
        return [Consumer(channel,
                         queues=[systopia],
                         callbacks=[self.handle_message],
                         accept=['json', 'pickle'])]

    def handle_message(self, body, message):
        print('Received message: {0!r}'.format(body))
        message.ack()
        # not tested below
        b = json.loads(body)

        if b['task'] == "initialize_teleoscope":
            res = tasks.querySearch.signature(
                args=("test", get_random_string(32)),
                kwargs={},
            )
            res.apply_async()

        if b['task'] == "reorient":
            res = robj.delay(
                teleoscope_id=b['args']["teleoscope_id"],
                positive_docs=b['args']["positive_docs"],
                negative_docs=b['args']["negative_docs"],
                query=b['args']["query"]
            )

app.steps['consumer'].add(WebTaskConsumer)

def get_random_string(length):
    # choose from all lowercase letter
    letters = string.ascii_lowercase
    result_str = ''.join(random.choice(letters) for i in range(length))
    return result_str