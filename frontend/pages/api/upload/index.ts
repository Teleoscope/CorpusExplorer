// Import necessary modules
import { promises as fs } from 'fs';
import { authOptions } from 'pages/api/auth/[...nextauth]';
import { getServerSession } from 'next-auth/next';
import { IncomingForm } from 'formidable';


// Disable Next.js's built-in body parser to handle 'multipart/form-data'
export const config = {
  api: {
    bodyParser: false,
  },
};

// Define the handler function as an async function
const handler = async (req, res) => {
  // Check for the session
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    // If not authenticated, return 401 Unauthorized
    return res.status(401).json({ message: "You must be logged in." });
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // Use formidable to parse the form data
  const data = await new Promise((resolve, reject) => {
    const form = new IncomingForm();

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      console.log(files)
      resolve({ fields, files });
    });
  });

  // Extract the file from the parsed data
  const file = data.files.file[0];

  if (!file) {
    // If no file is uploaded, return an error
    return res.status(400).json({ success: false, message: 'No file uploaded.' });
  } else {
    console.log(file)
  }

  // Process the uploaded file
try {
  if (!file.filepath) { // Ensure the filepath property exists
    throw new Error('File path is undefined');
  }

  const fileData = await fs.readFile(file.filepath); // Use the correct property for the file path
  const path = `/tmp/${file.originalFilename}`; // Ensure originalFilename is defined and used correctly
  await fs.writeFile(path, fileData);
  console.log(`File uploaded to ${path}`);

  return res.status(200).json({ success: true });
} catch (error) {
  console.error('Error processing the upload:', error);
  return res.status(500).json({ success: false, message: 'Server error processing the file.' });
}
};

// Export the handler as the default export
export default handler;
