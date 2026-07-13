// VisionOCR: macOS CLI wrapping Apple Vision text recognition.
//
// Usage: visionocr <image-path>
// Output: JSON lines, one recognized text line per row:
//   {"text": "...", "x": 0, "y": 0, "w": 0, "h": 0, "confidence": 0.0}
// Coordinates are pixels with a top-left origin.
//
// This is the same VNRecognizeTextRequest API surface iOS exposes, with the
// same settings the app will use (accurate mode, language correction off so
// drug names are not "corrected" into dictionary words), so accuracy numbers
// measured here transfer to the on-device Expo module.
//
// Compile: swiftc -O -framework Vision -framework AppKit -o visionocr VisionOCR.swift

import AppKit
import Foundation
import Vision

func fail(_ message: String, code: Int32) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(code)
}

guard CommandLine.arguments.count == 2 else {
    fail("usage: visionocr <image-path>", code: 2)
}

let path = CommandLine.arguments[1]
guard let image = NSImage(contentsOfFile: path),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    fail("cannot load image: \(path)", code: 1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false
request.recognitionLanguages = ["en-US"]

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
    try handler.perform([request])
} catch {
    fail("vision error: \(error.localizedDescription)", code: 1)
}

let width = CGFloat(cgImage.width)
let height = CGFloat(cgImage.height)
var output = ""

for observation in request.results ?? [] {
    guard let candidate = observation.topCandidates(1).first else { continue }
    // Vision bounding boxes are normalized with a bottom-left origin.
    let box = observation.boundingBox
    let record: [String: Any] = [
        "text": candidate.string,
        "x": (box.origin.x * width).rounded(),
        "y": ((1 - box.origin.y - box.height) * height).rounded(),
        "w": (box.width * width).rounded(),
        "h": (box.height * height).rounded(),
        "confidence": Double(candidate.confidence),
    ]
    let data = try JSONSerialization.data(withJSONObject: record, options: [.sortedKeys])
    output += String(data: data, encoding: .utf8)! + "\n"
}

print(output, terminator: "")
