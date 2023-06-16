import React, { useState, useContext } from "react";
import { useAppSelector, useAppDispatch } from "@/util/hooks";

// material ui
import LoadingButton from "@mui/lab/LoadingButton";

// custom components
import DocumentListItem from "@/components/Documents/DocumentListItem";
import ItemList from "@/components/ItemList";
import { setSelection } from "@/actions/windows";
import { StompContext } from "@/components/Stomp";

export default function DocumentList(props) {
  const data = props.data;
  const dispatch = useAppDispatch();
  const client = useContext(StompContext);
  const session_id = useAppSelector(
    (state) => state.activeSessionID.value
  );
  

  const renderItem = (index, item, currentIndex, setIndex) => {
    return (
      <DocumentListItem
        showReadIcon={true}
        setIndex={setIndex}
        listIndex={index}
        group={props.group}
        highlight={index == currentIndex}
        id={item[0]}
        key={item[0] + "DocumentListItem"}
        {...props}
      />
    );
  };

  if (props.loading) {
    return <LoadingButton></LoadingButton>;
  }

  const onSelect = (doc) => {
    if (doc) {
      dispatch(
        setSelection({
          nodes: [{ id: doc[0], data: { type: "Document" } }],
          edges: [],
        })
      );
      client.mark(doc[0], session_id, true);
    }
  };

  return (
    <ItemList data={data} render={renderItem} onSelect={onSelect}></ItemList>
  );
}
