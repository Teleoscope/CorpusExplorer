import ujson as json
import argparse
import os
from os import listdir
from os.path import isfile, join
import zstandard
import logging

from . import utils
from . import tasks
from . import schemas

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s [%(levelname)s]: %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S')

parser = argparse.ArgumentParser(
                    prog='Pushshift to MongoDB',
                    description='Takes Pushshift ZST files and puts them into MongoDB.',
                    epilog='Still under construction.')

parser.add_argument('directory')                              # directory to parse
parser.add_argument('-d', '--database', default="test")       # which database to insert into
parser.add_argument('-s', '--subreddit', nargs='+')           # the subreddit(s) to parse space delimited
parser.add_argument('-k', '--chunk-size')                     # how large

# Configuration fields
parser.add_argument('-t', '--text', default="selftext")       # the text field
parser.add_argument('-T', '--title', default="title")         # the title field
parser.add_argument('-r', '--relationships')                  # the relationships field
parser.add_argument('-m', '--metadata')                       # the metadata fields
parser.add_argument('-u', '--uid')                            # a UID field

# True/false option fields
parser.add_argument('-c', '--check',
                    action='store_true')                      # only print the output rather than inserting into MongoDB
parser.add_argument('-v', '--vectorize',
                    action='store_true')                      # vectorize text while putting in MongoDB

parser.add_argument('-e', '--keyerrors',
                    action='store_true')                      # log key errors


class Pushshift:
    def __init__(self, args):
        self.args = args
        self.db = None
        self.complete = []
        self.incomplete = []
        self.db = utils.connect(db=self.args.database)

    def upload(self, obj):
        if self.args.uid != None:
            found = list(self.db.documents.find({"metadata.id": obj[self.args.uid]}))
            if len(found) > 0:
                logging.warning(f"document with {obj[self.args.uid]} already in database")
                return
        text = obj[self.args.text]
        title = obj[self.args.title]
        if len(text) == 0 or text == '[removed]' or text == '[deleted]':
            return
        vector = []
        if self.args.vectorize:
            vector = tasks.vectorize_text(text)
        doc = schemas.create_document_object(title, vector, text, metadata=obj)
        try:
            self.db.documents.insert_one(doc)
        except Exception as err:
            logging.exception("Insert failed: ", doc, err)
      
    def handle(self, obj):
        if self.args.check:
            logging.info(obj['subreddit'], len(obj['selftext']))
        else:
            self.upload(obj)

    def processfile(self, filepath):
        # reader = zreader.Zreader(filepath, chunk_size=8192)
        # Read each line from the reader
        # for line in reader.readlines():
        for line, file_bytes_processed in self.read_lines_zst(filepath):
            try:
                obj = json.loads(line)
                if self.args.subreddit != None:
                    if obj["subreddit"] in self.args.subreddit:
                        self.handle(obj)
            except KeyError as err:
                if self.args.keyerrors:
                    logging.info(f"KeyError {err}.")
                pass
            except Exception as err:
                logging.exception(f"Unexpected error for {filepath}.")

                

    def process(self, files):
        outdir = os.path.join(self.args.directory, "done")
        errdir = os.path.join(self.args.directory, "err")

        if not os.path.exists(outdir):
            os.mkdir(outdir)
        
        if not os.path.exists(errdir):
            os.mkdir(errdir)

        for filename in files:
            filepath = os.path.join(self.args.directory, filename)
            logging.info(f'started {filename}.')
            try:
                self.processfile(filepath)
                logging.info(f'finished {filename}.' )
                os.rename(filepath, os.path.join(outdir, filename))
            except Exception as err:
                logging.info(f'error for {filename}')
                os.rename(filepath, os.path.join(errdir, filename))
                pass

    def read_lines_zst(self, filepath):
        with open(filepath, 'rb') as file_handle:
            buffer = ''
            reader = zstandard.ZstdDecompressor(max_window_size=2**31).stream_reader(file_handle)
            while True:
                chunk = self.read_and_decode(reader, 2**27, (2**29) * 2)

                if not chunk:
                    break
                lines = (buffer + chunk).split("\n")

                for line in lines[:-1]:
                    yield line, file_handle.tell()

                buffer = lines[-1]

            reader.close()

    def read_and_decode(self, reader, chunk_size, max_window_size, previous_chunk=None, bytes_read=0):
        chunk = reader.read(chunk_size)
        bytes_read += chunk_size
        if previous_chunk is not None:
            chunk = previous_chunk + chunk
        try:
            return chunk.decode()
        except UnicodeDecodeError:
            if bytes_read > max_window_size:
                raise UnicodeError(f"Unable to decode frame after reading {bytes_read:,} bytes")
            logging.info(f"Decoding error with {bytes_read:,} bytes, reading another chunk")
            return self.read_and_decode(reader, chunk_size, max_window_size, chunk, bytes_read)
            

if __name__ == "__main__":
    # Parse the arguments
    args = parser.parse_args()
    
    # Get all files (not directories) in given directory
    files = [f for f in listdir(args.directory) if isfile(join(args.directory, f))]

    logging.info(f"Starting to process the following files in {args.directory}:")
    for f in files:
        logging.info(f)
    
    ps = Pushshift(args)
    ps.process(files)
    
    # print arguments
    logging.info(args)