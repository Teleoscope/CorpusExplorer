import React from "react";

// mui
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

// custom components
import TopBar from "./WindowModules/TopBar";
import WindowManager from "./WindowFolder/WindowManager";
import ContextMenu from "./Context/ContextMenu";
import Flow from "./Flow";


export default function Workspace(props) {
  interface MouseCoords {
    mouseX: number,
    mouseY: number
  }
  const [contextMenu, setContextMenu] = React.useState<MouseCoords | null>(null);
  const handleOpenContextMenu = (event) => {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? {
          mouseX: event.clientX + 2,
          mouseY: event.clientY - 6,
        }
        : // repeated contextmenu when it is already open closes it with Chrome 84 on Ubuntu
        // Other native context menus might behave different.
        // With this behavior we prevent contextmenu from the backdrop to re-locale existing context menus.
        null,
    );
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };


  const handleClick = (e) => {
    console.log(e)
  }


  return (
    <div
      onContextMenu={handleOpenContextMenu}
      style={{ cursor: 'context-menu' }}
      onClick={(e) => handleClick(e)}
    >

      <Grid container spacing={0}>
        <Grid item xs={12}>
          <TopBar isConnected={props.isConnected} />
        </Grid>
        <Grid item xs={12}>
        <Stack direction="row">
          <WindowManager />
          <div style={{ height: '100vh', width: '50vw' }}>
            <Flow></Flow>
          </div>
        </Stack>

        </Grid>
        
      </Grid>
      <ContextMenu
        handleCloseContextMenu={handleCloseContextMenu}
        contextMenu={contextMenu}
      />

    </div>

  );
}


