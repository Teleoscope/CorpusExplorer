import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { addEdge } from "reactflow";
import { useAppSelector, useAppDispatch, useWindowDefinitions } from "@/util/hooks";
import { RootState } from "@/stores/store";
import { useSWRHook } from "@/util/swr";
import {
  updateNodes,
  updateEdges,
  makeEdge,
  makeNode,
  removeWindow,
  setSelection,
  toggleMinMax
} from "@/actions/windows";
import FlowProviderWrapper from "@/components/Flow/FlowProviderWrapper";
import FlowWrapper from "@/components/Flow/FlowWrapper";
import FlowUIComponents from "@/components/Flow/FlowUIComponents";
import ContextMenuHandler from "@/components/ContextMenuHandler";
import FlowFABWrapper from "@/components/Flow/FlowFABWrapper";
import "reactflow/dist/style.css";
import lodash from 'lodash';
import { setNodes, setEdges, setColor, addDocumentToGroup, copyCluster, saveUIState } from "@/actions/windows";
import { loadBookmarkedDocuments } from "@/actions/windows";
import WindowNode from "@/components/Nodes/WindowNode";
import ButtonEdge from "@/components/Nodes/ButtonEdge";
import { findTargetNode, getClosestEdge } from "@/util/drag";
import { useSession } from "next-auth/react";

interface MouseCoords {
  mouseX: number;
  mouseY: number;
  worldX: number;
  worldY: number;
}

function Flow(props) {
  const wdefs = useWindowDefinitions();
  const nodeTypes = useMemo(() => ({ windowNode: WindowNode, ...wdefs.nodeTypeDefs()}), []);
  const edgeTypes = useMemo(() => ({default: ButtonEdge}), []);

  const dispatch = useAppDispatch()

  const swr = useSWRHook();
  
  // this ref stores the current reactflow ref in the DOM
  const reactFlowWrapper = useRef(null);
  
  // this ref stores the current dragged node
  const dragRef = useRef(null);
  
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [tempEdges, setTempEdges] = useState([]);

  // target is the node that the node is dragged over
  const [target, setTarget] = useState(null);
  const [contextMenu, setContextMenu] = useState<MouseCoords | null>(
    null
  );
  const workflow_id = useAppSelector((state) => state.activeSessionID.value);
  
  const { data, status } = useSession();
  const userid = data?.user?.id;
  
  

  const bookmarks = useAppSelector((state: RootState) => state.windows.bookmarks);

  const settings = useAppSelector((state) => state.windows.settings);

  const { nodes, edges, logical_clock } = useAppSelector((state) => state.windows);

  const { session } = swr.useSWRAbstract("session", `sessions/${workflow_id}`);
  const session_history_item = session?.history[0];



  useEffect(() => {
    
    if (session_history_item) {
      if (session_history_item.logical_clock > logical_clock) {
        let incomingNodes = [];
        if (session_history_item.nodes) {
          incomingNodes = session_history_item.nodes;
        } else if (session_history_item.windows) {
          incomingNodes = session_history_item.windows;
        }
    
        let incomingEdges = [];
        if (session_history_item.edges) {
          incomingEdges = session_history_item.edges;
        }
    
        dispatch(
          setNodes({
            nodes: incomingNodes,
            logical_clock: session_history_item.logical_clock,
          })
        );
    
        dispatch(
          setEdges({
            edges: incomingEdges,
            logical_clock: session_history_item.logical_clock,
          })
        );
    
        dispatch(
          setColor({
            color: session_history_item.color,
          })
        );
    
        dispatch(loadBookmarkedDocuments(session_history_item.bookmarks));
      }
    }
  }, [session, session_history_item, logical_clock, userid]);
  
  

  const make_connection = (edge) => {
    return {
      source: edge.source,
      sourceHandle: edge.source,
      target: edge.target,
      targetHandle: edge.target
    }
  }


  const onNodeDragStop = (evt, node) => {
    if (node?.data?.type == "Document") {
      if (target) {
        if (target.data.type == "Group") {
          dispatch(addDocumentToGroup({
            group_id: target.id.split("%")[0],
            document_id: node.id.split("%")[0]
        }));
          dispatch(removeWindow({node: node.id}));
        }
      }
    }

    if (node?.data?.type == "Document" || node?.data?.type == "Note" || node?.data.type == "Group") {
      // if (tempEdges.length == 1 && tempEdges[0] != null) {
      //   const connection = make_connection(tempEdges[0])
      //   create_edge(connection, edges)
      //   setTempEdges([])
      // }
    }

    if (node?.data?.type == "Cluster") {
      if (target) {
        if (target.data.type == "Groups") {
          dispatch(copyCluster({graph_id: node.id.split("%")[0], workflow_id: workflow_id})); // TODO: ADD index here
          dispatch(removeWindow({node: node.id}));
        }
      }
    }

    setTarget(null);
    dragRef.current = null;
  };

  const onNodesChange = useCallback((changes) => {
    dispatch(updateNodes({changes: changes}));
  }, []);

  const onEdgesChange = useCallback((changes) => {
    dispatch(updateEdges({changes: changes}));
  }, []);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onNodeDragStart = (evt, node) => { dragRef.current = node };

  const onNodeDoubleClick = useCallback((event, node) => {
    dispatch(toggleMinMax(node.id))
  },[])

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const id = event.dataTransfer.getData("application/reactflow/id");
      const type = event.dataTransfer.getData("application/reactflow/type");
      const index = event.dataTransfer.getData("application/reactflow/index");

      // check if the dropped element is valid
      if (typeof id === "undefined" || !id) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      dispatch(makeNode({
        oid   : id,
        type  : type,
        width : settings.default_document_width,
        height: settings.default_document_height,
        x     : position.x,
        y     : position.y,
        index : index 
      }));
    },
    [reactFlowInstance, settings]
  );

  

  const handleOpenContextMenu = (event) => {
    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    setContextMenu(
      contextMenu === null
        ? {
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
            worldX: position.x,
            worldY: position.y,
          }
        : // repeated contextmenu when it is already open closes it with Chrome 84 on Ubuntu
          // Other native context menus might behave different.
          // With this behavior we prevent contextmenu from the backdrop to re-locale existing context menus.
          null
    );
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const onPaneContextMenu = (e) => {
    event.preventDefault();
    handleOpenContextMenu(e);
  };  

  const create_edge = (connection, curredges) => {
    const newEdges = addEdge(connection, []);
    dispatch(makeEdge({
      connection: connection,
      edges: newEdges
    }));
  }

  const isValidConnection = (connection) => {
    const source = nodes.find(n => n.id == connection.source)
    const target = nodes.find(n => n.id == connection.target)

    if ( source && target ) {
      if (source.type == "Note" && target.type == "Projection") {
        return false
      }
      
      if (source.type == "Search" 
          && target.type == "Projection" 
          && connection.targetHandle.split("_").slice(-1)[0] === "control") {
        return false
      }
      // add other conditions if needed
      return true
    }


    return false
  }

  const onConnect = useCallback((connection, curredges) => {
      create_edge(connection, curredges)
  }, []);

  const onSelectionChange = useCallback(({ nodes, edges }) => {
    dispatch(setSelection({ nodes: nodes, edges: edges }));
  }, []);

  const onNodeDrag = useCallback((evt, node) => {
    if (
        node?.data.type == "Document" || 
        node?.data.type == "Note"     || 
        node?.data.type == "Group"
      ) {
      setTarget(findTargetNode(node, nodes))
      handleTempEdge(evt, node); 
    }
    
  }, [getClosestEdge, setTempEdges, nodes]);

  const handleTempEdge = (_, node) => {
      // const closeEdge = getClosestEdge(node, nodes, edges);
      // if (closeEdge) {
      //   closeEdge.className = styles.temp
      // }
      // setTempEdges([closeEdge])
    }

    const throttledSave = useRef(
      lodash.throttle((sessionId, bookmarks, nodes, edges) => {
        const node_size = new TextEncoder().encode(JSON.stringify(nodes)).length / 1024
        const edge_size = new TextEncoder().encode(JSON.stringify(edges)).length / 1024
        dispatch(saveUIState({bookmakes: bookmarks, nodes: nodes, edges: edges}));
      }, 5000)  // waits 5000 ms after the last call
    ).current;
    
    const handleOnClick = () => {
      throttledSave(workflow_id, bookmarks, nodes, edges)
    }

    useEffect(() => {
      return () => {
        throttledSave.cancel();
      };
    }, []);

  
  

  return (
    <div className="providerflow">
      <FlowProviderWrapper>
        <div
          className="reactflow-wrapper"
          ref={reactFlowWrapper}
          style={{ width: `calc(100% - ${props.drawerWidth})`, height: "97vh" }}
        >
          <FlowWrapper
            nodes={nodes}
            edges={edges}
            tempEdges={tempEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onClick={handleOnClick}
            onNodeDrag={onNodeDrag}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            onPaneContextMenu={onPaneContextMenu}
            onSelectionChange={onSelectionChange}
            isValidConnection={isValidConnection}
            // onNodeDoubleClick={onNodeDoubleClick}
          >
            <FlowUIComponents
              fabWrapper={
                <FlowFABWrapper reactFlowInstance={reactFlowInstance} />
              }
            />
          </FlowWrapper>
          <ContextMenuHandler
            handleCloseContextMenu={handleCloseContextMenu}
            contextMenu={contextMenu}
          />
        </div>
      </FlowProviderWrapper>
    </div>
  );
}

export default Flow;
