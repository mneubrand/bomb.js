#!/bin/bash

# Remove old build
rm -rf out
mkdir out

# Compress JavaScript and HTML
cat bomb.js jsmodplayer.js song.js jsfxr.js > out/concat.js
java -jar compiler.jar --compilation_level ADVANCED_OPTIMIZATIONS --js out/concat.js --js_output_file out/closure.js
uglifyjs -mt -nc --unsafe --max-line-len 0 -o out/bomb.js out/closure.js
cp prefix.js out/prefix.js
cp index.html out/index.html

# Zip resources
cd out
zip -q -9 package.zip index.html bomb.js prefix.js

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
