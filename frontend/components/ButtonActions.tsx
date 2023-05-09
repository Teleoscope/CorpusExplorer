// ButtonActions.tsx
import React, { useContext } from "react";

// mui
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";

export default function ButtonActions(props) {
  return (
    <>
      <Stack
        direction="row"
        justifyContent="right"
        alignItems="center"
        style={{ margin: 0 }}
      >
        {props.inner.map(([Component, props]) => Component(props))}
      </Stack>
      <Divider />
    </>
  );
}
