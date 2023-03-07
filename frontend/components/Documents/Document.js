// Window.js
import React from "react";

// custom
import DocumentText from "./DocumentText"
import GroupSelector from "../GroupSelector"
import NoteButton from "../WindowModules/NoteButton"

// mui
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';

//utils
import useSWRAbstract from "../../util/swr"
import { PreprocessText } from "../../util/Preprocessers"

export default function Document(props) {
  console.log("props", props)
  const id = props.id.split("%")[0];
  const { document } = useSWRAbstract("document", `/api/document/${id}`);
  const text = document ? PreprocessText(document.text) : false;
  return (
    <div style={{ overflow: "auto", height: "100%", marginTop: "0em" }}>

      <Stack direction="row" justifyContent="right" alignItems="center" style={{ margin: 0 }}>
        <NoteButton id={document?._id} key="document" />
        
        <GroupSelector id={id} />
      </Stack>
      <Divider />
      <DocumentText text={text} />

      <Divider sx={{margin: 5}}/>
    </div>
  )
}
