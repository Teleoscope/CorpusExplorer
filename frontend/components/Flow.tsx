import React, { useState, useCallback, useContext, useRef } from "react";
import { addEdge } from "reactflow";
import { useAppSelector, useAppDispatch } from "@/util/hooks";
import { RootState } from "@/stores/store";
import { swrContext } from "@/util/swr";
import {
  updateNodes,
  updateEdges,
  makeEdge,
  makeNode,
  removeWindow,
  setSelection,
} from "@/actions/windows";
import { sessionActivator } from "@/actions/activeSessionID";
import { StompContext } from "@/components/Stomp";
import { SessionLoader } from "@/components/SessionLoader";
import FlowProviderWrapper from "@/components/FlowProviderWrapper";
import FlowWrapper from "@/components/FlowWrapper";
import FlowUIComponents from "@/components/FlowUIComponents";
import ContextMenuHandler from "@/components/ContextMenuHandler";
import WindowNode from "@/components/Nodes/WindowNode";
import FlowFABWrapper from "@/components/FlowFABWrapper";

import "reactflow/dist/style.css";
import styles from "@/styles/flow.module.css";

const nodeTypes = { windowNode: WindowNode };

function Flow(props) {

  const client = useContext(StompContext);
  const swr = useContext(swrContext);
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
  const session_id = useAppSelector((state) => state.activeSessionID.value);
  const userid = useAppSelector((state) => state.activeSessionID.userid);

  const bookmarks = useAppSelector(
    (state: RootState) => state.bookmarker.value
  );

  const settings = useAppSelector((state) => state.windows.settings);

  const { nodes, edges, logical_clock } = useAppSelector(
    (state) => state.windows
  );


  const { session, session_loading, session_error } = swr.useSWRAbstract(
    "session",
    `sessions/${session_id}`
  );
  const { user } = swr.useSWRAbstract("user", `users/${userid}`);

  const session_history_item = session?.history[0];
  const dispatch = useAppDispatch();

  if (user && session_error) {
    dispatch(sessionActivator(user.sessions[0]));
  }

  if (session_history_item) {
    SessionLoader(session_history_item, logical_clock);
  }



  const onNodeDragStart = (evt, node) => {
    dragRef.current = node;
  };

  const handleTarget = (node) => {
    // calculate the center point of the node from position and dimensions
    const centerX = node.position.x + node.width / 2;
    const centerY = node.position.y + node.height / 2;

    // find a node where the center point is inside
    const targetNode = nodes.find(
      (n) =>
        centerX > n.position.x &&
        centerX < n.position.x + n.width &&
        centerY > n.position.y &&
        centerY < n.position.y + n.height &&
        n.id !== node.id // this is needed, otherwise we would always find the dragged node
    );
    setTarget(targetNode);
  };

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
          client.add_document_to_group(
            target.id.split("%")[0],
            node.id.split("%")[0]
          );
          dispatch(removeWindow(node.id));
        }
      }
      if (tempEdges.length == 1 && tempEdges[0] != null) {
        const connection = make_connection(tempEdges[0])
        create_edge(connection, edges)
        setTempEdges([])
      }

    }

    if (node?.data?.type == "Cluster") {
      if (target) {
        if (target.data.type == "Group Palette") {
          client.copy_cluster(node.id.split("%")[0], session_id);
          dispatch(removeWindow(node.id));
        }
      }
    }

    setTarget(null);
    dragRef.current = null;
  };

  const onNodesChange = useCallback((changes) => {
    dispatch(updateNodes(changes));
  }, []);

  const onEdgesChange = useCallback((changes) => {
    dispatch(updateEdges(changes));
  }, []);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const id = event.dataTransfer.getData("application/reactflow/id");
      const type = event.dataTransfer.getData("application/reactflow/type");

      // check if the dropped element is valid
      if (typeof id === "undefined" || !id) {
        return;
      }

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });
      const newNode = {
        id: id,
        // type: id.type,
        type: "windowNode",
        position: position,
        positionAbsolute: position,
        style: {
          width: settings.default_document_width,
          height: settings.default_document_height,
        },
        data: { label: `${id} node`, i: id, type: type },
      };
      dispatch(makeNode({ node: newNode }));
    },
    [reactFlowInstance, settings]
  );

  interface MouseCoords {
    mouseX: number;
    mouseY: number;
    worldX: number;
    worldY: number;
  }

  const handleOpenContextMenu = (event) => {
    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = reactFlowInstance.project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
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
    dispatch(makeEdge({ edges: newEdges }));
  }

  const onConnect = useCallback((connection, curredges) => {
      create_edge(connection, curredges)
  
  }, []);

  const onSelectionChange = useCallback(({ nodes, edges }) => {
    dispatch(setSelection({ nodes: nodes, edges: edges }));
  }, []);


  const getClosestEdge = (node) => {
    const X_MIN_DISTANCE = 50;
    const Y_MIN_DISTANCE = 100;
    
    const closestNode = nodes.filter(n => n.data.type == "Teleoscope").reduce(
      (res, n) => {
        if (n.id !== node.id) {
          edges.forEach((e) => {
            if (e.source == node.id && e.target == n.id) {
              return;
            }
          })
          const _dx = (n.positionAbsolute.x) - (node.positionAbsolute.x + node.width);
          const _dy = (n.positionAbsolute.y + n.height/2) - (node.positionAbsolute.y + node.height/2);
          
          const dx = Math.sqrt(_dx * _dx);
          const dy = Math.sqrt(_dy * _dy);

          // console.log("dist", dx, dy)

          if (dx < res.distance && dx < X_MIN_DISTANCE && dy < Y_MIN_DISTANCE) {
            res.distance = dx;
            res.node = n;
          }
        }
        return res;
      },
      {
        distance: Number.MAX_VALUE,
        node: null,
      }
    );

    if (!closestNode.node) {
      return null
    }

    return {
      id: `${node.id}-${closestNode.node.id}`,
      source: node.id,
      target: closestNode.node.id,
    };
  }


  const onNodeDrag =  useCallback((evt, node) => {
    if (node?.data.type == "Document") {
      handleTarget(node);
      handleTempEdge(evt, node);  
    }
  }, [getClosestEdge, setTempEdges]);

  const handleTempEdge = (_, node) => {
      const closeEdge = getClosestEdge(node);
      if (closeEdge) {
        closeEdge.className = styles.temp
      }
      setTempEdges([closeEdge])
    }
    
  

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
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onClick={() =>
              client.save_UI_state(session_id, bookmarks, nodes, edges)
            }
            onNodeDrag={onNodeDrag}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            onPaneContextMenu={onPaneContextMenu}
            onSelectionChange={onSelectionChange}
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
