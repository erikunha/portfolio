type MdastNode = {
  type: string;
  name?: string;
  value?: string;
  children?: MdastNode[];
  data?: Record<string, unknown>;
};

declare function remarkTableCaption(): (tree: MdastNode, file?: { value?: string }) => void;

export default remarkTableCaption;
