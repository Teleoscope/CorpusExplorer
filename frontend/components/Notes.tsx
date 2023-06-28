import React, { useContext } from "react";

// mui
import {
  IconButton,
  Stack,
  List,
  ListItem,
  ListItemIcon,
} from "@mui/material";

import DeleteIcon from "@mui/icons-material/Delete";
import { ContentState, convertToRaw } from "draft-js";

// custom
import EditableText from "@/components/EditableText";

// actions
import { useAppSelector, useAppDispatch, useWindowDefinitions } from "@/util/hooks";
import { RootState } from "@/stores/store";

// utils
import { useSWRHook } from "@/util/swr";
import { useStomp } from "@/components/Stomp";
import { NewItemForm } from "./NewItemForm";
import { onDragStart } from "@/util/drag";

export default function Notes(props) {
  const client = useStomp();
  const wdefs = useWindowDefinitions();
  const session_id = useAppSelector((state: RootState) => state.activeSessionID.value);

  const settings = useAppSelector((state) => state.windows.settings);

  const swr = useSWRHook();
  const { notes_raw } = swr.useSWRAbstract(
    "notes_raw",
    `sessions/${session_id}/notes`
  );
  const dispatch = useAppDispatch();

  const notes = notes_raw?.map((n) => {
    const ret = {
      _id: n._id,
      label: n.history[0].label,
    };
    return ret;
  });



    const handleNewNote = (e) => {
      const content = convertToRaw(ContentState.createFromText(" "));
      client.add_note(session_id, e.target.value, content);
    };


  return (
    <div style={{ overflow: "auto", height: "100%" }}>
      <NewItemForm 
        label="Create new note" 
        HandleSubmit={handleNewNote}      
      />
      <List>
        {notes?.map((n) => (
          <div
            key={n._id}
            draggable={true}
            style={{ position: "relative" }}
            onDragStart={(e) =>
              onDragStart(e, n._id, "Note")
            }
          >
            <ListItem key={n._id}>
              <Stack
                sx={{ width: "100%" }}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
              >
                <Stack direction="row" alignItems="center">
                  <ListItemIcon>
                      {wdefs.definitions()["Note"].icon()}
                  </ListItemIcon>

                  <EditableText
                    initialValue={n.label}
                    callback={(label) => client.relabel_note(n._id, label)}
                  />
                </Stack>
                <IconButton
                  onClick={() => client.remove_note(n._id, session_id)}
                >
                  <DeleteIcon
                    sx={[
                      {
                        "&:hover": {
                          color: props.color,
                        },
                      },
                    ]}
                  ></DeleteIcon>
                </IconButton>
              </Stack>
            </ListItem>
          </div>
        ))}
      </List>
    </div>
  );
}
