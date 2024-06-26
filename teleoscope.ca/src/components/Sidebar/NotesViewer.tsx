import {
  Stack,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider
} from "@mui/material";
import { useAppSelector, useWindowDefinitions } from "@/lib/hooks";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

export default function NotesViewer({ id }) {
  
  const { data: note } = useSWRF(`note/${id}`);
  const settings = useAppSelector((state) => state.appState.workflow.settings);
  const wdefs = useWindowDefinitions();

  return (
    <Accordion
      defaultExpanded={settings.defaultExpanded}
      disableGutters={true}
      square={true}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="panel3a-content"
        id="panel3a-header"
      >
        <Typography noWrap align="left">
          {wdefs.definitions()["Note"].icon()}
          {`${note?.history[0].label}`}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1} sx={{ margin: "1em" }}>
          <Typography variant="h5">{note?.history[0].label}</Typography>
          <Divider></Divider>
          <Typography variant="small">{note?.history[0].content.blocks[0].text}</Typography>
        </Stack>
      </AccordionDetails>
    </Accordion>
    
  );
}
