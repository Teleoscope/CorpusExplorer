import React from "react"

import { useAppSelector, useAppDispatch } from '../../hooks'
import { RootState } from '../../stores/store'
import useSWRAbstract from "../../util/swr"
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import FolderIcon from '@mui/icons-material/Folder';
import { dragged } from "../../actions/windows";

export default function Clusters(props) {
    const session_id = useAppSelector((state: RootState) => state.activeSessionID.value);
    const { clusters } = useSWRAbstract("clusters", `/api/sessions/${session_id}/clusters`);
    const dispatch = useAppDispatch();

    const onDragStart = (event, id, type, typetag) => {
      event.dataTransfer.setData('application/reactflow/type', type);
      event.dataTransfer.setData('application/reactflow/id', `${id}%${typetag}`);
      event.dataTransfer.effectAllowed = 'move';
    };

    return (
      <div style={{ overflow: "auto", height: "100%" }}>
        <List>
        {clusters?.map((cluster) => {
           return (
              <div
              key={cluster._id}
                 style={{ overflow: "auto", height: "100%" }}
                 draggable={true}
                 onDragStart={(e) => onDragStart(e, cluster._id + "%cluster", "Cluster", "cluster")}
              >
                 <ListItem>
                    <ListItemIcon>
                       <FolderIcon sx={{ color: cluster.history[0].color }} />
                    </ListItemIcon>
                    <ListItemText
                       primary={cluster.history[0].label}
                       secondary={cluster._id}
                    />
                 </ListItem>
              </div>
           )
        })}
     </List>
     </div>
    )
}
        
