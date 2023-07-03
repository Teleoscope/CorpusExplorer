import React from "react";
import { Button, Stack, TextField } from "@mui/material";
import { InputAdornment } from "@mui/material";
import { alpha } from "@mui/material";
import { useSWRHook } from "@/util/swr";
import { AccountCircle } from "@mui/icons-material";
import { useStomp } from "@/components/Stomp";
 
export default function Account(props) {
  const swr = useSWRHook();
  const client = useStomp();

  const [value, setValue] = React.useState("");
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleEnterUser(value);
    } else {
      setValue(e.target.value);
    }
  };


  const handleTimeOut = (username) => {
    fetch(
      `https://${swr.subdomain}.${process.env.NEXT_PUBLIC_FRONTEND_HOST}/api/${swr.subdomain}/user/${username}`
    )
      .then((response) => response.json())
      .then((user) => {
        if (user != null) {
          props.handleSignIn(user);
        } else {
          props.handleSignOut();
        }
      });
  };

  // Helper functions
  const handleEnterUser = (username) => {
    if (!username) {
      return;
    }
    const url = `https://${swr.subdomain}.${process.env.NEXT_PUBLIC_FRONTEND_HOST}/api/${swr.subdomain}/user/${username}`;

    fetch(url)
      .then((response) => response.json())
      .then((user) => {
        if (user != null) {
          props.handleSignIn(user);
        } else {
          client.register_account(value, "password", swr.database);
          setTimeout(() => handleTimeOut(username), 2000);
        }
      });
  };

  return (
    <Stack direction="row" spacing={1}>
      <TextField
        id="input-with-icon-textfield"
        sx={{ width: "75%", backgroundColor: alpha("#FFFFFF", 0.0) }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <AccountCircle />
            </InputAdornment>
          ),
        }}
        label="Username"
        variant="standard"
        defaultValue={props.user?.username}
        onKeyUp={(e) => handleKeyPress(e)}
      />
      <Button onClick={() => handleEnterUser(value)}>Sign in</Button>
    </Stack>
  );
}
