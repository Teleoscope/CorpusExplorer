'use client';

import { useState } from 'react';
import { Button, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { read, utils } from 'xlsx';
import Table from '@/components/Table'; // Ensure this component can handle the data format provided

function previewFile(file, setHeaders, setPreviewData) {
  if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
    previewCsv(file, setHeaders, setPreviewData);
  } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx')) {
    previewXlsx(file, setHeaders, setPreviewData);
  }
}

function previewXlsx(file, setHeaders, setPreviewData, headerLine = 1) {
  const reader = new FileReader();
  reader.onload = function (event) {
    const data = new Uint8Array(event.target.result);
    const workbook = read(data, { type: 'array', sheetRows: headerLine + 4 });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const json = utils.sheet_to_json(worksheet, { header: 1, range: headerLine - 1 }).slice(0, 5);
    setHeaders(json[0]);
    setPreviewData(json.slice(1)); // Exclude header row from preview data
  };
  reader.readAsArrayBuffer(file);
}

function previewCsv(file, setHeaders, setPreviewData, headerLine = 1) {
  const reader = new FileReader();
  reader.onload = function (event) {
    const text = event.target.result;
    const lines = text.split('\n').slice(headerLine - 1);
    const headers = lines[0].split(',').map(header => header.trim());
    const json = lines.slice(1, 6).map(line => line.split(",").map(cell => cell.trim()));
    setHeaders(headers);
    setPreviewData(json);
  };
  reader.readAsText(file);
}

export default function Uploader() {
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [uniqueId, setUniqueId] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const newFile = e.target.files?.[0];
    if (!newFile) {
      setError("No file selected.");
      return;
    }
    setFile(newFile);
    setError('');
    previewFile(newFile, setHeaders, setPreviewData);
  };

  const uploadFile = async () => {
    if (!file) {
      setError('No file selected for upload.');
      return;
    }
    setError('');
    const data = new FormData();
    data.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: data,
      });
      if (!response.ok) throw new Error(await response.text());
      setError('');
      // Handle success
      alert('File uploaded successfully');
    } catch (error) {
      console.error(error);
      setError('Failed to upload file.');
    }
  };

  return (
    <div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <Button variant="contained" component="label">
        Choose File
        <input type="file" hidden onChange={handleFileChange} accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
      </Button>
      <Button variant="contained" onClick={uploadFile} disabled={!file}>
        Upload
      </Button>

      {headers.length > 0 && (
        <>
          <FormControl fullWidth margin="normal">
            <InputLabel>Unique ID</InputLabel>
            <Select
              value={uniqueId}
              label="Unique ID"
              onChange={(e) => setUniqueId(e.target.value)}
            >
              {headers.map((header, index) => (
                <MenuItem key={index} value={header}>{header}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel>Title</InputLabel>
            <Select
              value={title}
              label="Title"
              onChange={(e) => setTitle(e.target.value)}
            >
              {headers.map((header, index) => (
                <MenuItem key={index} value={header}>{header}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel>Text</InputLabel>
            <Select
              value={text}
              label="Text"
              onChange={(e) => setText(e.target.value)}
            >
              {headers.map((header, index) => (
                <MenuItem key={index} value={header}>{header}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Table data={previewData} />
        </>
      )}
    </div>
  );
}


