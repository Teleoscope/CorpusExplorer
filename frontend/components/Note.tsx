import React, { useRef, useEffect } from "react";
import { Editor, EditorState, convertFromRaw, convertToRaw } from "draft-js";
import "draft-js/dist/Draft.css";
import lodash from 'lodash';

// mui
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";

//utils
import { useSWRHook } from "@/util/swr";

// contexts
import { useStomp } from "@/util/Stomp";

export default function Note(props) {
  const id = props.id.split("%")[0];
  const swr = useSWRHook();
  const { note } = swr.useSWRAbstract("note", `note/${id}`);

  const client = useStomp();
  const editor = React.useRef(null);

  const debouncedSave = useRef(
    lodash.debounce((e) => {
      const content = e.getCurrentContent();
      client.update_note(id, convertToRaw(content));
    }, 1000)  // waits 5000 ms after the last call
  ).current;

  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, []);

 

  const handleLoad = () => {
    if (note) {
      const item = note["history"][0];
      if (item && Object.keys(item.content).length > 0) {
        return EditorState.createWithContent(convertFromRaw(item["content"]));
      }
    }
    return EditorState.createEmpty();
  };

  const [editorState, setEditorState] = React.useState(() => handleLoad());

  // Handlers
  const handleBlur = () => {
    const content = editorState.getCurrentContent();
  };

  const handleOnChange = (e) => {
    setEditorState(e);
    debouncedSave(e);
  };

  

  const focusEditor = () => {
    editor.current.focus();
  };

  return (
    <Card
      variant="outlined"
      style={{
        backgroundColor: "white",
        height: "100%",
        // marginBottom:"-1em"
      }}
      sx={{
        boxShadow: "0",
      }}
    >
      <div style={{ overflow: "auto", height: "100%" }}>
        <Stack
          direction="column"
          onClick={focusEditor}
          style={{ marginLeft: "10px", cursor: "text" }}
        >
          <Editor
            ref={editor}
            editorState={editorState}
            onBlur={handleBlur}
            onChange={handleOnChange}
            // placeholder={document ? document["title"] : props.id}
          />
        </Stack>
      </div>
    </Card>
  );
}
