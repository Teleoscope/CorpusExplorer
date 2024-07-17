// mui
import { Stack, Slider, Typography, Switch } from "@mui/material";

// actions
import { useAppSelector, useAppDispatch } from "@/lib/hooks";

// custom components
import { setSettings, setColor } from "@/actions/appState";
import ColorPicker from "@/components/ColorPicker";

export default function Settings(props) {
  const dispatch = useAppDispatch();
  const { workspace, workflow } = useAppSelector((state) => state.appState);

  const handleChange = (event, value) => {
    dispatch(setSettings(value));
  };

  const handleColorChange = (color) => {
    dispatch(setColor({color: color}))
  };


  return (
    <Stack>
      <Typography>Dropped item width</Typography>
      <Slider
        aria-label="default_document_width"
        defaultValue={workspace.settings?.document_width}
        valueLabelDisplay="auto"
        step={25}
        marks
        min={50}
        max={500}
        onChangeCommitted={(event, value) =>
          handleChange(event, { workspace: {settings: {document_width: value}}})
        }
        sx={{ color: workflow.settings.color }}

      />
      <Typography>Dropped item height</Typography>
      <Slider
        aria-label="default_document_height"
        defaultValue={workspace.settings?.document_height}
        valueLabelDisplay="auto"
        step={25}
        marks
        min={30}
        max={500}
        onChangeCommitted={(event, value) =>
          handleChange(event, { workspace: {settings: {document_height: value}}})
        }
        sx={{ color: workflow.settings.color }}
      />
      <Typography>Automatically Expand Infopanel</Typography>
      <Switch
        checked={workspace.settings?.expanded}
        onChange={(event, value) =>
          handleChange(event, { workspace: {settings: {expanded: value}}})
        }
        color="primary"
        sx={{
          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
            backgroundColor: workflow.settings.color,
          },
          ".MuiSwitch-colorPrimary": { color: workflow.settings.color },
        }}
      />
      <Typography>Workflow Color</Typography>
      <ColorPicker
        defaultColor={workflow.settings.color}
        onChange={handleColorChange}
      ></ColorPicker>
      <Typography>Title Length</Typography>
      <Slider
        aria-label="default_title_length"
        defaultValue={workflow.settings.title_length}
        valueLabelDisplay="auto"
        step={1}
        min={10}
        max={200}
        onChangeCommitted={(event, value) =>
          handleChange(event, { workflow: {settings: {title_length: value}}})
        }
        sx={{ color: workflow.settings.color }}
      />
    </Stack>
  );
}
