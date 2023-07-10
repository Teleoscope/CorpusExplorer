import React from "react";

import {
  MenuItem,
} from "@mui/material";
import { Box } from "@mui/material";
import { FormControl } from "@mui/material";
import { FormHelperText } from "@mui/material";
import { InputLabel } from "@mui/material";
import { Select } from "@mui/material";
import { Button } from "@mui/material";
import { useSWRHook } from "@/util/swr";

// contexts 
import { useStomp } from "@/util/Stomp";
export default function AddUserDialogue(props) {
  const client = useStomp();
  const swr = useSWRHook();
  const { users } = swr.useSWRAbstract("users", `users/`);

  const [dialogValue, setDialogValue] = React.useState({ label: "" });

  return (
    <Box component="form" sx={{ display: "flex", flexWrap: "wrap" }}>
      <FormControl variant="filled">
        <InputLabel id="demo-simple-select-helper-label">User</InputLabel>
        <Select
          labelId="demo-simple-select-helper-label"
          id="demo-simple-select-helper"
          label="User"
          value={dialogValue.label}
          onChange={(event) => setDialogValue({ label: event.target.value })}
        >
          <MenuItem value="">None</MenuItem>
          {users?.map((u) => (
            <MenuItem key={u._id} value={u}>
              {u.username}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>Select User</FormHelperText>
      </FormControl>
      <Button
        onClick={() => {
          client.add_user_to_session(dialogValue.label._id, props.session_id);
        }}
      >
        Add
      </Button>
    </Box>
  );
}
