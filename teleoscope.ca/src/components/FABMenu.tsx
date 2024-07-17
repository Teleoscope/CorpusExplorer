//FABMenu.tsx

import React from "react";
import SpeedDial from "@mui/material/SpeedDial";
import SpeedDialIcon from "@mui/material/SpeedDialIcon";
import SpeedDialAction from "@mui/material/SpeedDialAction";

// actions
import { makeNode } from "@/actions/appState";
import { useDispatch } from "react-redux";
import { useAppSelector, useWindowDefinitions } from "@/lib/hooks";

export default function FABMenu({ windata }) {
  const [open, setOpen] = React.useState(true);
  const dispatch = useDispatch();  
  const wdefs = useWindowDefinitions();
  const { workflow, workspace } = useAppSelector((state) => state.appState);
  
  const actions = [
    "Search",
    "Group",
    "Rank",
    "Projection",
    "Note",
    "Divider",
    "Union",
    "Difference",
    "Intersection",
    "Exclusion"
  ]

  const actionMap = {
    "Search": "Search",
    "Group": "Group",
    "Rank": "Rank",
    "Projection": "Projection",
    "Note": "Note",
    "Divider": "Divider",
    "Union": "Union",
    "Difference": "Difference",
    "Intersection": "Intersection",
    "Exclusion":" Exclusion"
  }

  const handleAddNode = (type) => {
    dispatch(makeNode({
      oid: type, 
      type: type,
      width: workspace.settings?.document_width,
      height: workspace.settings?.document_height,
      x: windata.x + windata.width + 10, 
      y: windata.y
    }));
  };


  const handleClick = () => {
    setOpen(!open);
  };

  return (
    <SpeedDial
      ariaLabel="SpeedDial basic example"
      direction="down"
      icon={<SpeedDialIcon />}
      className="drag-handle"
      FabProps={{
        sx: {
          bgcolor: workflow.settings.color,
          "&:hover": {
            bgcolor: workflow.settings.color,

          },
        },
      }}
      onClick={handleClick}
   
      open={open}
      transitionDuration={10}
    >
      {actions.map((action) => {

        if (action == "Divider") {
         return <SpeedDialAction key={action} sx={{ visibility: 'hidden', height: "1px", margin: 0, padding: 0 }} />
        }
          return <SpeedDialAction
          sx={{ color: workflow.settings.color }}
          key={action}
          icon={wdefs.definitions()[action].icon()}
          tooltipTitle={actionMap[action]}
          tooltipPlacement="right"
          tooltipOpen={workspace.settings.showFABToolTip}
          onClick={() =>
            handleAddNode(
              wdefs.definitions()[action].type
            )
          }
          />
      }

       
      )}
    </SpeedDial>
  );
}
