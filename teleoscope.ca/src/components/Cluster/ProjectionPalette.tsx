// Core MUI Components
import { Stack, List, ListItem, ListItemIcon } from "@mui/material";
import { Diversity2 as Diversity2Icon } from "@mui/icons-material";

// Custom Components
import EditableText from "@/components/EditableText";
import Deleter from "@/components/Deleter";
import { NewItemForm } from "../NewItemForm";

// Redux and Hooks
import { useAppSelector } from "@/lib/hooks";
import { RootState } from "@/lib/store";
import { useAppDispatch } from "@/lib/hooks";
import { initializeProjection } from "@/actions/appState";

// Utilities
import { onDragStart } from "@/lib/drag";
import { removeProjection, relabelProjection } from "@/actions/appState";
import { useSWRF } from "@/lib/swr";

export default function ProjectionPalette(props) {
  const dispatch = useAppDispatch()
  const settings = useAppSelector((state: RootState) => state.appState.workflow.settings);
  const workflow_id = useAppSelector((state: RootState) => state.appState.workflow._id);
  
  
  const { data: projections_raw } = useSWRF(
    `workflow?workflow=${workflow_id}&projections`
  );

  const projections = projections_raw?.map((p) => {
    const ret = {
      _id: p._id,
      label: p.history[0].label,
    };
    return ret;
  });


  return (
    <div style={{ overflow: "auto", height: "100%" }}>
            <Stack>

      <NewItemForm 
        label="Create new Projection"
        HandleSubmit={(e) => dispatch(initializeProjection({
          label: e.target.value,
        }))}
      />
        <List>
          {projections?.map((p) => {
            return (
              <div
                key={p._id}
                style={{ overflow: "auto", height: "100%" }}
                draggable={true}
                onDragStart={(e) => onDragStart(e, p._id, "Projection")}
              >
                <ListItem key={p._id}>
                  <Stack
                    sx={{ width: "100%" }}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Stack direction="row" alignItems="center">
                      <ListItemIcon>
                        <Diversity2Icon />
                      </ListItemIcon>

                      <EditableText
                        initialValue={p.label}
                        callback={(label) => dispatch(relabelProjection({
                          label: label,
                          projection_id: p._id,
                        }))
                        }
                      />
                    </Stack>
                    <Deleter 
                      callback={() => dispatch(removeProjection({
                        projection_id: p._id
                      }))} 
                      color={settings.color}
                    />
                  </Stack>
                </ListItem>
              </div>
            );
          })}
        </List>
        </Stack>
    </div>
  );
}
