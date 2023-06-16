import React from "react";
import SearchIcon from "@mui/icons-material/Search";
import FlareIcon from "@mui/icons-material/Flare";
import TopicIcon from "@mui/icons-material/Topic";
import Diversity2Icon from "@mui/icons-material/Diversity2";
import CommentIcon from "@mui/icons-material/Comment";

const actions = {
  FABMenu: {
    icon: <SearchIcon />,
    default_window: {
      i: "default_FABMenu",
      w: 1,
      h: 1,
      type: "FABMenu",
      isResizable: false,
    },
  },
  Search: {
    icon: <SearchIcon />,
    default_window: {
      i: "%search",
      w: 5,
      h: 9,
      type: "Search",
      isResizable: true,
    },
  },
  Teleoscopes: {
    icon: <FlareIcon />,
    default_window: {
      i: "%teleoscopepalette",
      w: 5,
      h: 9,
      type: "Teleoscope Palette",
      isResizable: true,
      showWindow: true,
    },
  },
  Teleoscope: {
    icon: <FlareIcon />,
    default_window: {
      i: "%teleoscope",
      w: 2,
      h: 1,
      type: "Teleoscope",
      isResizable: true,
    },
  },
  Groups: {
    icon: <TopicIcon />,
    default_window: {
      i: "%grouppalette",
      w: 5,
      h: 9,
      type: "Group Palette",
      isResizable: true,
    },
  },
  Cluster: {
    icon: <TopicIcon />,
    default_window: {
      i: "%cluster",
      w: 5,
      h: 9,
      type: "Cluster",
      isResizable: true,
    },
  },
  Projection: {
    icon: <Diversity2Icon />,
    default_window: {
      i: "%projection",
      w: 2,
      h: 1,
      type: "Projection",
      isResizable: true,
    },
  },
  Projections: {
    icon: <Diversity2Icon />,
    default_window: {
      i: "%projectionpalette",
      w: 5,
      h: 9,
      type: "Projection Palette",
      isResizable: true,
      showWindow: true,
    },
  },
  Notes: {
    icon: <CommentIcon />,
    default_window: {
      i: "%notepalette",
      w: 5,
      h: 9,
      type: "Note Palette",
      isResizable: true,
      showWindow: true,
    },
  },
};

export default function MenuActions() {
  return actions;
}
