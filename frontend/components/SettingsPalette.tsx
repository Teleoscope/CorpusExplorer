import React, { useState, useContext } from "react";

// mui
import { Stack, Box, Slider, Typography } from "@mui/material";

// actions
import { useAppSelector, useAppDispatch } from "@/util/hooks";
import { RootState } from "@/stores/store";

// custom components
import {
  setSettings
} from "@/actions/windows";

export default function SettingsPalette(props) {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.windows.settings)

  const handleChange = (event, value, setting) => {
    console.log("settings", event, value, setting)
    var temp = {...settings}
    temp[setting] = value;
    dispatch(setSettings(temp))
  }

  return (
    <Stack sx={{ margin: "2px" }}>
      <Typography>Dropped item width</Typography>
      <Slider
        aria-label="default_document_width"
        defaultValue={settings.default_document_width}
        valueLabelDisplay="auto"
        step={25}
        marks
        min={50}
        max={500}
        onChangeCommitted={(event, value) => handleChange(event, value, "default_document_width")}
      />
      <Typography>Dropped item height</Typography>
      <Slider
        aria-label="default_document_height"
        defaultValue={settings.default_document_height}
        valueLabelDisplay="auto"
        step={25}
        marks
        min={30}
        max={500}
        onChangeCommitted={(event, value) => handleChange(event, value, "default_document_height")}
      />
    </Stack>
  );
}
