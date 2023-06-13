import React, { useContext } from "react";
import Window from "@/components/WindowFolder/Window";
import WindowDefinitions from "@/components/WindowFolder/WindowDefinitions";
import { swrContext } from "@/util/swr";
import { useSelector } from "react-redux";

export default function WindowFactory(props) {
  const w = props.windata;

  const windowState = useSelector((state) => state.windows);
  const wdefs = WindowDefinitions(windowState);

  const keymap = {
    note: "note",
    notes: "notes",
    notepalette: "notes",
    fabmenu: "fabmenu",
    group: "groups",
    grouppalette: "groups",
    document: "document",
    teleoscope: "teleoscopes",
    teleoscopes: "teleoscopes",
    teleoscopepalette: "teleoscopes",
    search: "search",
    groups: "groups",
    clusters: "clusters",
    cluster: "cluster",
    operation: "operation",
    Note: "note",
    Notes: "notes",
    Notepalette: "notes",
    FABMenu: "fabmenu",
    Group: "groups",
    Grouppalette: "groups",
    Document: "document",
    Teleoscope: "teleoscopes",
    Teleoscopes: "teleoscopes",
    Teleoscopepalette: "teleoscopes",
    Search: "search",
    Groups: "groups",
    Clusters: "clusters",
    Cluster: "cluster",
    Operation: "operation"
  };
  const type = w.type;
  const oid = w.data?.id ? w.data.id : w.i.split("%")[0];

  const key = keymap[type];
  const swr = useContext(swrContext);
  const { data } = w?.demo
    ? w.demodata
    : swr.useSWRAbstract("data", `${key}/${oid}`);

  if (w.type == "FABMenu") {
    return <div>{wdefs[w.type].component(w, w.label, "#FFFFFF")}</div>;
  }

  return (
    <Window
      {...props}
      id={w.label}
      icon={wdefs[w.type].icon(data)}
      inner={wdefs[w.type].component(w, w.label, wdefs[w.type].color(data))}
      showWindow={wdefs[w.type].showWindow || w.showWindow}
      data={data}
      title={wdefs[w.type].title(data)}
      color={wdefs[w.type].color(data)}
      demo={w.demo}
      demodata={w.demodata}
    />
  );
}
