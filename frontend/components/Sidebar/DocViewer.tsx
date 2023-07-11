import { useSWRHook } from "@/util/swr";

import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { Typography, Stack, List, ListItem, Divider } from "@mui/material";
import { useAppSelector, useWindowDefinitions } from "@/util/hooks";
import { DocumentActions } from "@/components/Documents/DocumentActions";
import Highlighter from "@/components/Highlighter";

export default function DocViewer(props) {
  const swr = useSWRHook(); 
  const { document } = props.windata?.demo
    ? props.windata.demodata
    : swr.useSWRAbstract("document", `document/${props.id}`);
  const settings = useAppSelector((state) => state.windows.settings);
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
          {wdefs.definitions()["Document"].icon()}
          {`${document?.title.slice(0, 20)}...`}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1} sx={{ margin: "1em" }}>
          <Typography variant="h5">{document?.title}</Typography>
          <Divider></Divider>
          <DocumentActions document={document} />
          <Typography><Highlighter>{document?.text}</Highlighter></Typography>
          <List>
            {document?.metadata
              ? Object.entries(document.metadata).map(([key, value]) => {
                  return (
                    <ListItem key={key + value}>
                      <Typography variant="caption" sx={{ marginRight: "1em" }}>
                        {key}:{" "}
                      </Typography>
                      <Typography noWrap variant="caption">
                        {JSON.stringify(value)}
                      </Typography>
                    </ListItem>
                  );
                })
              : ""}
          </List>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
