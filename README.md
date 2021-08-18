# README

This project is a UI for filtering down a large number of documents for eventual qualitative analysis. It is being purpose-built for looking through the 600k+ posts on Reddit's AITA forum to extract information on the norms and expectations regarding digital privacy behaviours. This README has two purposes: (1) like a normal readme, explain how to run the code; and (2) to document the building process for eventual analysis on the building process itself.

# Version 0.3.0
This version is now deployable on Azure servers. As such, it comes with a new install script. Only tested on Ubuntu 20.04 so far. Requires sudo privileges.

## Installation
```
git clone https://github.com/pbucci/CorpusExplorer.git
cd CorpusExplorer
chmod u+x install.sh
sudo ./install.sh
```

You should be prompted for your MongoDB URI and DB. Right now, the URI includes password-protected information and should be requested directly from an admin. The DB is `aita`. Similarly, the system requires an SSH tunnel to work, so you'll have to also request that access from an admin. After that, you can add this to your .ssh config:

```
Host bastion-host
    User <your username for the bastion host>
    HostName remote.cs.ubc.ca
    IdentityFile ~/.ssh/id_rsa
    Port 22

Host bastion-host-mongo-forward
    User <your other username>
    Port 22
    IdentityFile ~/.ssh/id_rsa
    HostName <the hostname of the machine behind the host>
    ProxyJump <your username for the bastion host>@bastion-host

    # MongoBD forward
    Localforward 3307 <the hostname of the machine behind the host>:27017
    # RabbitMQ remote python/celery connection
    Localforward 3308 <the hostname of the machine behind the host>:5672
```




# Version 0.2.0

Major overhaul for this version:

- Switched to a Next.JS (React) front-end development framework
- Backend NLP proccessing handled by Gensim
- Added distributed workers for handling ongoing NLP tasks

## Why the current packages

### NextJS

NextJS is a development framework for React. React handles UI state changes by managing a virtual DOM. This reduces the amount of explicit state management and interrelated callbacks that you might otherwise have to program explicitly in. React also leverages a lot of syntactic sugar to help manage rendering DOM elements which speeds up development. Finally, React is also widely-supported and there are many libraries available that make development faster. NextJS specifically provides built-in support for data fetching, including handling asynch calls and local caching. It also provides built-in API routing.

The design of the front end is to essentially leverage this API functionality. Read-only calls to the MongoDB backend are managed through the API. NextJS's data fetching features manage the problem of making sure your data is always available and not stale, so MongoDB updates are propagated to the UI in what appears to be immediately.

### RabbitMQ

The previous version of the TFIDF Explorer required the corpus data to be loaded into and transformed in memory. However, some NLP functions take a long time to complete, and managing asynchronous operations in Python can be very difficult. Celery/RabbitMQ provide a method for distributing asychronous tasks (Celery is the python package, RabbitMQ is the message broker). Downside is that you can't share memory/pass pointers between workers which means that serialization is a big cost---however, since a lot of this processing is going on in the background while the user can do other things, it's not very visible. Upside is that not having to deal with Python's explicit management of yielding async calls means you can design a completely distributed processing framework with low overhead and do, e.g., partial computes.

### Gensim

Genism is essentially an topic modelling/NLP prototyping package with a lot of one-liner built-in support for a lot of common NLP tasks from tokenizing to model-building. It works well with SciKit, and provides a variety of Soft Similarity measures and hierarchical clustering methods.

## MongoDB structure

Right now the structure of MongoDB is to have a different collection for each major unit of operation which are connected through unique OIDs. This is the recommended structure to avoid destructive data transformations and to keep a relatively flat hierarchy. GridFS is used for large (16mb+) models.

Considering using Redis for local caching in the future, but for now, MongoDB is only written to by workers and read by the NextJS API.

## Query Workflow

The concept of interacting with this system is based around querying and browsing. You might have some idea of what you want to look for, but you don't yet know the exact relationships between words and documents and would like to discover them. The workflow would be:

- come up with an interesting query and enter it
- see an immediate document count
- enter another query to compare it
- repeat until you have found a doc count and query set that you can deal with (emotionally, intellectually, computationally)

In the background, each query will have started a whole chain of NLP processing. Documents are fetched, turned into dictionaries and bag-of-words corpuses, and TFIDF scores are calculated. Although this may change soon, right now, a model of word similarities built from Wikipedia is used to calculate a Soft Cosine Similarity index which allows you to use the index as a lookup for further subqueries. Since a whole document can be used as a query, this can be used to build Docs x Docs similarity matrices if needed.

Now that you have a set of documents and at least two similarity measures (TFIDF for Words X Docs and Soft Cosine Similarity for Words or Docs x Docs), you can start to manually include/exclude documents and words. The exact way this works is still TBD but essentially we can imagine:

- Docs can be included in groups to indicate similarity manually
- Docs can be excluded from base query sets to remove them from any further modelling within that query on the next recalculation
- Words can be included in groups to indicate simiarity manually
- Words can be excluded from dictionaries to remove them as features of the models

It may be useful to train small Word2Vec models on document subsets and then retrain as more documents are confirmed added to groups. This may be useful to reflect the qualitative methodology of thematic analysis. Therefore the full process is encapsulated in four stages:

- Browse queries to find proposed documents
- Inspect the documents to see whether the proposed documents were useful, make notes, do initial qualitative analysis steps of annotation
- Refine queries to create groups of words and documents
- Recalculate models based on your current staged changes

My current challenge is figuring out how to manage the include/exclude process with MongoDB (views??) and how to manage recording state. Since I like being able to recalculate the whole process (and likely needs to be included for reproducibility reasons), this should likely be done similar to design programs that use constraint-based functional modelling (like SolidWorks) but TBD.

# Version 0.1.0

# Setup

This project is basically a front end build in [Bootstrap](https://getbootstrap.com/) for [Scikit Learn](https://scikit-learn.org/stable/install.html) and uses [Numpy](https://numpy.org/) for most scientific computing. The database it expects is [MongoDB](https://www.mongodb.com/) and uses [Socket.io](https://socket.io/) to communicate between back and front ends. Oh, and [D3.js](https://d3js.org/) powers the visualization. Because of all the different technologies at play here, I wanted to avoid React and Flask, so there are some funny-looking hacks that you'll see as a result. I'm using [Anaconda](https://www.anaconda.com/) to manage the development environment.

The packages should include all of the web technologies, so you will only have to install the python packages for the above. You can use `pip install` for most with no problem, but I suggest setting up a conda virtual environment first. I will assume a prebuilt MongoDB database for this version with documentation below.

## Suggested installation workflow

1. Install Anaconda, then go to a terminal and `conda activate <virtual environment name>`.
2. Install Scikit Learn.
3. Install the following supporting packages with this handy copy-paste code:

```
pip install socketio
pip install pymongo
pip install bottleneck
pip install progressbar
```

Test the install by running `python async-server.py`. If anything blows up because it is missing, install that package and complain to the owners. Navigate to http://localhost:8080/dashboard/index.html in a browser to see if everything loads.

This first in-development version release has been set up to do three important things:

- Search the database for documents given a query
- Run TF-IDF on the documents, producing a TF-IDF matrix for each word
- Run cosine similarity on the documents, producing document similarity scores

Given these functions, we can start the process of iterated semi-supervised learning on the documents provided. That is not yet included in this version, but will be the next step in the project. Each subsection below will overview the major concepts that the UI uses and actions that a user will take to filter the database.

## Frontend

The high-level idea for this interface is to enable learning-through-browsing. You want to be able to eventually get an idea of your big corpus, but also have small, local ideas of what you are interested in as part of building towards an eventual qualitative thematic analysis. The design descisions are focused around making the browsing process and the process of thematic analysis actually create better machine learning models that can be used in further document exploration.

### Defining stopwords

The UI provides a quick way to filter through stopwords. You can use Min/Max document frequency scores to do automatic filtering, or browse through with manual filtering. Since a good automatic filter will be quite agressive (e.g., must show up in over 10 documents, and less than 25% of all documents), you need a way to pick through interesting terms that might be automatically excluded. In this interface, you do that by dragging and dropping terms between the "words" card, the "stopwords" card, and the "keywords" card.

The stopwords card is a working set that is local to the current document selection subset. You can commit the stopwords to a global stopwords set, which will remove them from the card, but remain in memory.

### Defining keywords

Keywords are terms that are potentially useful to keep. Eventually, there will be some function to structure similarity between keywords, but right now, they are just a local set. They will be highlighted in document previews, but otherwise, they have no further function except being preserved in a set.

## Document browsing

Right now, just five random documents show up in the document browsing selection. You can drag and drop them to the "include" and "exclude" bins, but it doesn't do anything. In the very near future, this will start to build connection matrices for hierarchical clustering.

### Backend and mechanics

The high-level idea for the backend is to create a server that produces machine learning models as a result of browsing. The rough dataflow idea is keep to unidirectional dataflow.

A server manages communication between the UI and different processes. Communication with the UI is via Websockets (socket.io python port), communcation with the database is via pymongo.

The server interacts with a TFIDFProcessorManager which manages TFIDFProcessors. Right now the server also directly calls the Processors, but I'm moving that into the mangager.

## Database setup

This project uses MongoDB as a database. MongoDB was chosen after attempts at SQL databases proved to not be flexible or cross-compatible enough for the different kinds of machine learning data structures used here.
