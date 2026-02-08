import { useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";

type Props = {
  fileBlob: Blob;
  page: number;
  yCoord?: number;
};

export default function StatementViewer({ fileBlob, page, yCoord }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadPDF();
  }, [fileBlob, page]);

  async function loadPDF() {
    const url = URL.createObjectURL(fileBlob);
    const pdf = await pdfjsLib.getDocument(url).promise;
    const pdfPage = await pdf.getPage(page);

    const viewport = pdfPage.getViewport({ scale: 1.5 });
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await pdfPage.render({
      canvasContext: ctx,
      viewport
    }).promise;

    if (yCoord) drawHighlight(canvas, viewport.height, yCoord);
  }

  function drawHighlight(canvas: HTMLCanvasElement, pageHeight: number, y: number) {
    const ctx = canvas.getContext("2d")!;
    const screenY = pageHeight - y;

    ctx.fillStyle = "rgba(255,230,0,0.35)";
    ctx.fillRect(0, screenY - 12, canvas.width, 28);
  }

  return <canvas ref={canvasRef} style={{ width: "100%" }} />;
}
