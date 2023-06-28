// HelpMenu.tsx
import { Divider, Snackbar, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useKeyPress } from "reactflow";
import PanToolIcon from "@mui/icons-material/PanTool";
import ControlCameraIcon from "@mui/icons-material/ControlCamera";
import { GiResize } from 'react-icons/gi';
import { CgScrollV } from 'react-icons/cg';
import ReadMoreIcon from "@mui/icons-material/ReadMore";

export default function HelpMenu(props) {
    const spacePressed = useKeyPress('/');
    const [show, setShow] = useState(false);

    useEffect(() => {
        setShow(spacePressed)
    }, [spacePressed]);

    return (
        <Snackbar 
            open={show} 
            message={
                <>
                    <Typography sx={{fontWeight: "bold"}}><PanToolIcon sx={{ fontSize: 15 }}/> Pan</Typography>
                    <Typography variant="body">Hold Space and click to pan.</Typography>
                    <Divider sx={{bgcolor: "#555555", marginTop: "1em", marginBottom: "1em"}} />
                    
                    <Typography sx={{fontWeight: "bold"}}><ControlCameraIcon sx={{ fontSize: 15 }}/> Move</Typography>
                    <Typography variant="body">Move by clicking and dragging on a workspace item's titlebar.</Typography>
                    <Divider sx={{bgcolor: "#555555", marginTop: "1em", marginBottom: "1em"}} />

                    <Typography sx={{fontWeight: "bold"}}><GiResize sx={{ fontSize: 15 }}/> Resize</Typography>
                    <Typography variant="body">Resize by clicking and dragging on the edge of a workspace item.</Typography>
                    <Divider sx={{bgcolor: "#555555", marginTop: "1em", marginBottom: "1em"}} />


                    <Typography sx={{fontWeight: "bold"}}><ReadMoreIcon sx={{ fontSize: 15 }}/> Drag and Drop</Typography>
                    <Typography variant="body">Drag and drop by clicking on a document in the group and dragging it outside of the group.</Typography>
                    <Divider sx={{bgcolor: "#555555", marginTop: "1em", marginBottom: "1em"}} />                    

                    <Typography sx={{fontWeight: "bold"}}><CgScrollV sx={{ fontSize: 15 }}/> Zoom in and Out</Typography>
                    <Typography variant="body">Zoom in and out by scrolling the mouse wheel.</Typography>
                    
                </>
            }
        />
        
    )
}