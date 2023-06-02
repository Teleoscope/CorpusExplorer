import React, { useContext, useEffect, useCallback } from "react";

// material ui
import { Menu, MenuItem, Stack, Typography } from "@mui/material";

import { AccountCircle } from "@mui/icons-material";
import { Divider, IconButton } from "@mui/material";

// components
import Account from "@/components/WindowModules/Account";

// actions
import { sessionActivator, setUserId } from "@/actions/activeSessionID";
import { setDefault } from "@/actions/windows";
import { useDispatch, useSelector } from "react-redux";

// utilities
import { swrContext } from "@/util/swr";
import { useCookies } from "react-cookie";

// contexts
import { StompContext } from "@/components/Stomp";

export default function TopBar(props) {
  const [cookies, setCookie] = useCookies(["userid"]);
  const session_id = useSelector((state) => state.activeSessionID.value);
  const userid = useSelector((state) => state.activeSessionID.userid);
  const dispatch = useDispatch();
  const client = useContext(StompContext);
  const swr = useContext(swrContext);
  const { user } = swr.useSWRAbstract("user", `users/${userid}`);

  // useCallback(() => {
  //   if (cookies.userid != -1) {
  //     fetch(
  //       `http://${swr.subdomain}.${process.env.NEXT_PUBLIC_FRONTEND_HOST}/api/${swr.subdomain}/users/${cookies.userid}`
  //     )
  //       .then((response) => response.json())
  //       .then((user) => {
  //         handleSignIn(user);
  //       });
  //   }
  // }, [cookies.userid, userid]);

  const { session } = swr.useSWRAbstract("session", `sessions/${session_id}`);
  const { users } = swr.useSWRAbstract("users", `users/`);

  const handleSignOut = () => {
    setCookie("userid", -1, {
      path: "/",
    });
    dispatch(sessionActivator(-1));
    dispatch(setUserId(-1));
    client.userId = -1;
    dispatch(setDefault());
  };

  const handleSignIn = (user) => {
    console.log("client state", client)
    setCookie("userid", user._id, {
      path: "/",
    });
    dispatch(setUserId(user._id));
    dispatch(sessionActivator(user.sessions[0]));
    client.restart({userid: user._id, database: client.database})
    console.log("Stomp client: ", client, user)
  };

  const get_color = () => (session ? session.history[0].color : "#4E5CBC");

  const getUsers = () => {
    if (session && users) {
      let owner = session.userlist.owner;
      let contributors = session.userlist.contributors;

      // check if all users have already been added to session
      if (contributors.length + 1 === users.length) {
        return (
          <MenuItem value={"No users to be added..."}>
            No users to be added...
          </MenuItem>
        );
      }

      // show all users that are not already in userlist
      return users.map((u) => {
        if (!owner.includes(u._id) && !contributors.includes(u._id)) {
          return (
            <MenuItem key={u._id} value={u}>
              {u.username}
            </MenuItem>
          );
        }
      });
    }
    return <MenuItem value={""}>No session selected...</MenuItem>;
  };

  const [open, toggleOpen] = React.useState(false);

  const AccountMenu = () => {
    const [anchorEl, setAnchorEl] = React.useState(null);
    const [openMenu, setOpenMenu] = React.useState(false);

    const handleClickOpen = () => {
      toggleOpen(true);
    };

    const handleClose = () => {
      setDialogValue({
        label: "",
      });
      toggleOpen(false);
    };

    return (
      <Stack spacing={1} direction="row-reverse">
        <Stack spacing={0} direction="row" alignItems="center">
          <IconButton
            id="bIconasic-button"
            onClick={(event) => {
              setAnchorEl(event.currentTarget);
              setOpenMenu(true);
            }}
          >
            <AccountCircle sx={{ color: get_color() }}></AccountCircle>
          </IconButton>

          {props.compact ? (
            ""
          ) : (
            <Typography
              noWrap
              onClick={(event) => {
                setAnchorEl(event.currentTarget);
                setOpenMenu(true);
              }}
            >
              {user ? user.username : "Not signed in"}
            </Typography>
          )}
        </Stack>
        <Menu
          id="basic-menu"
          anchorEl={anchorEl}
          open={openMenu}
          onClose={() => {
            setAnchorEl(null);
            setOpenMenu(false);
          }}
        >
          <MenuItem
            onKeyDown={(e) => e.stopPropagation()}
            children={
              <Account
                user={user}
                handleSignIn={handleSignIn}
                handleSignOut={handleSignOut}
                client={client}
              />
            }
          ></MenuItem>
          <Divider></Divider>
          <MenuItem onClick={handleSignOut}>Sign out</MenuItem>
        </Menu>
      </Stack>
    );
  };

  // Main return for this component
  return <AccountMenu />;
}
