import React, { useState } from "react";
// mui
import {
  Box,
  Drawer,
  CssBaseline,
  Toolbar,
  Divider,
  Stack,
} from "@mui/material";

// custom
import Flow from "@/components/Flow";
import Accordion from "@/components/Accordion";
import TopBar from "./WindowModules/TopBar";
import TeleoscopeLogo from "./WindowModules/TeleoscopeLogo";

const drawerWidth = 300;
const breakpoint = 100;
const minWidth = 75;

export default function PermanentDrawerRight() {
  const [width, setWidth] = useState(drawerWidth);
  const [click, setClick] = useState(false);

  const handleResize = (event) => {
    if (click) {
      setWidth(Math.max(minWidth, window.innerWidth - event.clientX));
    }
  };


  const handleDoubleClick = () => {
    if (width == minWidth) {
      setWidth(drawerWidth)
    } else {
      setWidth(minWidth)
    }

  }

  const DrawerComponent = () => {
    const sx = {
      width: width,
      overflow: "hidden",
      flexShrink: 0,
      "& .MuiDrawer-paper": {
        width: width,
        boxSizing: "border-box",
      },
    };

    if (width < breakpoint) {
      return (
        <Drawer sx={sx} variant="permanent" anchor="right">
            <Stack direction="column" alignItems="center" spacing={1} sx={{paddingTop: "2em", paddingBottom: "2em"}}>
              <TeleoscopeLogo compact={true} color="#CCCCCC"></TeleoscopeLogo>
              <TopBar compact={true}></TopBar>
            </Stack>
          <Divider />
          <Accordion compact={true}></Accordion>
        </Drawer>
      );
    }

    return (
      <Drawer sx={sx} variant="permanent" anchor="right">
          <Stack direction="column" alignItems="center" spacing={1} sx={{paddingTop: "2em", paddingBottom: "2em"}}>
            <TeleoscopeLogo color="#CCCCCC"></TeleoscopeLogo>
            <TopBar></TopBar>
          </Stack>
        <Divider />
        <Accordion></Accordion>
      </Drawer>
    );
  };

  return (
    <Box
      sx={{ display: "flex" }}
      onMouseMove={handleResize}
      onMouseUp={() => setClick(false)}
    >
      <CssBaseline />
      <Box component="main" sx={{ flexGrow: 1, bgcolor: "background.default" }}>
        <Flow drawerWidth={width} />
      </Box>
      <Stack direction="row">
        <Box
          onMouseDown={() => setClick(true)}
          onDoubleClick={handleDoubleClick}
          sx={{
            height: "100%",
            width: "5px",
            cursor: "w-resize",
            borderLeft: "1px solid #D3D3D3",
          }}
        ></Box>
        <DrawerComponent></DrawerComponent>
      </Stack>
    </Box>
  );
}
