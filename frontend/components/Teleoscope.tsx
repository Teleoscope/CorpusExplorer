// Teleoscope.js
import React, { useState, useContext } from "react";

// mui
import LoadingButton from "@mui/lab/LoadingButton";

// custom components
import DocumentList from "@/components/Documents/DocumentList";

// util
import { useSWRHook } from "@/util/swr";

export default function Teleoscope(props) {
  const [teleoscope_id] = useState(props.id.split("%")[0]);
  const swr = useSWRHook();
  
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(10);

  const { teleoscope } = props.windata?.demo
    ? props.windata.demodata
    : swr.useSWRAbstract("teleoscope", `teleoscopes/${teleoscope_id}`);

  const data = teleoscope?.history[0]["rank_slice"];

  const handleLoadMore = () => {
    
  }

  return (
    <>
      {teleoscope ? (
        <DocumentList data={data} pagination={true} loadMore={handleLoadMore}></DocumentList>
      ) : (
        <LoadingButton loading={true} />
      )}
    </>
  );
}
