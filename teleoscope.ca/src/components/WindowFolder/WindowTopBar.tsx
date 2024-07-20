// MUI
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

// custom
import CloseButton from "@/components/WindowFolder/CloseButton";

// actions
import { useDispatch } from "react-redux";
import { minimizeWindow } from "@/actions/appState";

export default function WindowTopBar({reactflow_node_id, icon, title}) {
  const dispatch = useDispatch();
  return (
    <Stack
      sx={{ cursor: "move" }}
      direction="row"
      alignItems="flex-start"
      justifyContent="space-between"
      onDoubleClick={() => dispatch(minimizeWindow({id: reactflow_node_id }))}
    >
      
      <Typography variant="body1" component="div" sx={{ padding: 0.6 }}>
        {icon} {title}
      </Typography>
      <CloseButton reactflow_node_id={reactflow_node_id} size="small" />
    </Stack>
  );
}
