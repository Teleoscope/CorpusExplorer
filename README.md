# README

This project is a UI for filtering down a large number of documents for eventual qualitative analysis. It is being purpose-built for looking through the 600k+ posts on Reddit's AITA forum to extract information on the norms and expectations regarding digital privacy behaviours. This README has two purposes: (1) like a normal readme, explain how to run the code; and (2) to document the building process for eventual analysis on the building process itself.


## Backend Installation

First, we highly recommend setting up a virtual environment to manage your python packages. This tutorial assumes that you have Anaconda installed (https://www.anaconda.com/products/individual). Set up a new virtual environment and activate it. Then install Python 3.8 for your new virtual environment.

```
conda create --name teleoscope
conda activate teleoscope
conda install -c anaconda python=3.8
```

Then clone this repository and navigate to the backend folder.

```
git clone https://github.com/Teleoscope/Teleoscope.git
cd Teleoscope/backend
```

Install the backend requirements. If you're not using conda, you can replace "conda install" with "pip3 install".

```
pip3 install gensim tensorflow tensorflow_hub aiohttp_middlewares
conda install tqdm pymongo numpy celery aiohttp
```

Test your installation by opening up a python interactive shell, then importing the backend scripts.

```
$ python
Python 3.8.12 (default, Oct 12 2021, 06:23:56)
[Clang 10.0.0 ] :: Anaconda, Inc. on darwin
Type "help", "copyright", "credits" or "license" for more information.
>>> import tasks
>>> import server
>>> import utils
```

If you see this problem:

```
>>> import tasks
[1]    69853 illegal hardware instruction  python
```

Then you'll need to download the tensorflow wheel here: https://drive.google.com/drive/folders/1oSipZLnoeQB0Awz8U68KYeCPsULy_dQ7

then run `pip3 install /path/to/downloaded/whl`.

If you haven't gotten all of your login credentials sorted out, now is the time to do so. See below or talk to Paul. Once you have your credentials, check your connections by running `test.py`. You'll be first checking whether you're connected to MongoDB, then whether you can send tasks to the RabbitMQ queue and have a worker consume them.

```
$ python
Python 3.8.12 (default, Oct 12 2021, 06:23:56)
[Clang 10.0.0 ] :: Anaconda, Inc. on darwin
Type "help", "copyright", "credits" or "license" for more information.
>>> import install_test
```

## SSH and Login

### Credentials
For now, contact Paul to ensure that you have the login credentials for the following:
- MonogDB
- Leap machine
- RabbitMQ queue

Before testing the backend connections, you'll need to create an `auth.py` module. This is just a python file that has your private information in it:

```
mongodb = {
	"username": "<mongodb_username>",
	"password": "<mongodb_password>",
	"host": "localhost:<local forwarding port, e.g., 3307>",
	"string": "mongodb://<mongodb_username>:<mongodb_password>@localhost:<local forwarding port>/aita"
}

rabbitmq = {
	"username": "<rabbitmq_username>",
	"password": "<rabbitmq_password>",
	"host": "localhost",
	"vhost": "<vhost name>"
}
```

### Setting up the SSH tunnel
SSH (Secure Shell) is a networking protocol that allows you to connect a port on your local machine to a remote machine. Any data you send through such an SSH tunnel is encrypted and secure. We need an SSH connection to the leap machine to securely access the MongoDB database instance running on it.

If you open a Terminal, you will be in your (i.e., the user’s) home directory. You can use `ls -a` to see all visible and hidden folders. You may already have a .ssh folder and a public-private-key pair. If not, create keys by running `ssh-keygen`. If you type `ls ~/.ssh` you should now see three files: `id_rsa` for your private key, `id_rsa.pub` for your public key and `config` for the configuration file (if you do not see a config file you can create one with `touch ~/.ssh/config`).

You should now be able to connect to the leap machine with your CWL password.

```
ssh \
-i ~/.ssh/id_rsa \
-J <your CWL username>@remote.students.cs.ubc.ca \
   <your leap machine username>@<IP address of leap server>
```

If you want, you can store your login credentials in thew config file. 

If you haven't installed a text editor yet, first install nano (or another command line text editor of your choice) with `sudo apt install nano`. You can find instructions on how to use nano here: https://linuxize.com/post/how-to-use-nano-text-editor/. Add the following to your config file using `sudo nano ~/.ssh/config`:

```
Host jump-host
    User <your CWL username>
    HostName remote.cs.ubc.ca
    IdentityFile ~/.ssh/id_rsa
    Port 22

Host leap-server
    User <your leap machine username>
    Port 22
    IdentityFile ~/.ssh/id_rsa
    HostName <IP address of leap server>
    ProxyJump <your CWL username>@jump-host

    # MongoBD forward
    Localforward 3307 <IP address of leap server>:27017
    # RabbitMQ remote python/celery connection
    Localforward 3308 <IP address of leap server>:5672
    # RabbitMQ STOMP connection
    Localforward 3309 <IP address of leap server>:61613
    # RabbitMQ Admin panel
    Localforward 3310 <IP address of leap server>:15672
    # RabbitMQ WebSTOMP connection
    Localforward 3311 <IP address of leap server>:15674
```

If you don’t want to have to enter your password every time, distribute your public ssh key onto the jump host and the leap server using `ssh-copy-id -i ~/.ssh/id_rsa.pub jump-host` and `ssh-copy-id -i ~/.ssh/id_rsa.pub leap-server`.

You should now be able to connect to the leap server by running `ssh leap-server` in your Terminal.


# Version 0.3.0
This version is now deployable on Azure servers. As such, it comes with a new install script. Only tested on Ubuntu 20.04 so far. Requires sudo privileges.

## Frontend Installation
```
git clone https://github.com/UntitledCorpusExplorer/CorpusExplorer.git
cd CorpusExplorer
chmod u+x install.sh
sudo ./install.sh
```

You should be prompted for your MongoDB URI and Database name. Right now, the URI includes password-protected information and should be requested directly from an admin. The DB is `aita`. Similarly, the system requires an SSH tunnel to work, so you'll have to also request that access from an admin. After that, you can add this to your .ssh config:

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

Last, run `npm run build` to test the install and `ssh bastion-host-mongo-forward` to test the ssh tunnel.


## Running
If you are already connected to the bastion host, leave it running and open another tab and cd to the frontend: `cd /path/to/CorpusExplorer/frontend`. Then run `npm run dev` for live dev builds with hotswapped code, or `npm run start` for production builds.

