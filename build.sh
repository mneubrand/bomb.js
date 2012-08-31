#!/bin/bash

# Remove old build
rm -rf out
mkdir out

# Compress JavaScript and HTML
cat jsfxr.min.js bomb.js > out/concat.js
java -jar compiler.jar --compilation_level ADVANCED_OPTIMIZATIONS --js out/concat.js --js_output_file out/bomb.js
java -jar htmlcompressor-1.5.3.jar --type html -o out/index.html index.html

# Zip resources
cd out
zip -q -9 package.zip index.html bomb.js

# Check file size
BYTES=`du -b package.zip | sed 's/\s.*//'`
echo "$BYTES total package size"
if [ "$BYTES" -lt 13312 ]
then
  echo "Build successful!"
  exit 0
else
  echo "Build failed!"
  exit -1
fi
