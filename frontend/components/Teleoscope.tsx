// Teleoscope.js
import { useState } from "react";

// mui
import LoadingButton from "@mui/lab/LoadingButton";

// custom components
import DocumentList from "@/components/Documents/DocumentList";

// util
import { useSWRHook } from "@/util/swr";

export default function Teleoscope(props) {
  const [teleoscope_id] = useState(props.id.split("%")[0]);
  const swr = useSWRHook();

  const { teleoscope } = props.windata?.demo
    ? props.windata.demodata
    : swr.useSWRAbstract("teleoscope", `graph/${teleoscope_id}`);

  const doclists = teleoscope?.doclists;
 
  return (
    <>
      {teleoscope ? (
        <DocumentList data={doclists} pagination={true}></DocumentList>
      ) : (
        <LoadingButton loading={true} />
      )}
    </>
  );
}
