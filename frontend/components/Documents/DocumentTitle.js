import React from "react";

// MUI imports
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';

// fonts
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

export default function DocumentTitle(props) {
   return (
      <Tooltip title={props.title} placement="top">
         <Typography
            variant={props.size == "small" ? "caption" : "subtitle"}
            color={props.color ? props.color : "black"}
            noWrap={props.noWrap}
         >
            {props.title}
         </Typography>
      </Tooltip>
   )
}