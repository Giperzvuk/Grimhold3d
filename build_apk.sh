#!/bin/bash
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; A=$ROOT/android; B=$A/build; T=/tmp/tools/minapk/package/tools
AAPT2=/tmp/tools/aaptjs3/bin/x64/linux/aapt2
rm -rf $B && mkdir -p $B/res $B/classes $B/dex $ROOT/dist
echo "== aapt2 compile"; $AAPT2 compile --dir $A/res -o $B/res/compiled.zip
echo "== aapt2 link";    $AAPT2 link -o $B/resources.apk -I $T/android.jar --manifest $A/AndroidManifest.xml -A $ROOT/game --auto-add-overlay --java $B/gen $B/res/compiled.zip
echo "== ecj";           java -jar $T/ecj-3.45.0.jar -source 8 -target 8 -encoding UTF-8 -nowarn -bootclasspath $T/android.jar -classpath $T/android.jar -d $B/classes $(find $A/src $B/gen -name '*.java') 2>&1 | grep -v "warning\|^$\|Picked up" || true
echo "== d8";            java -cp $T/d8.jar com.android.tools.r8.D8 --release --min-api 26 --lib $T/android.jar --output $B/dex $(find $B/classes -name '*.class') 2>&1 | grep -v "Picked up" || true
echo "== package+align"; python3 $ROOT/pack.py $B/resources.apk $B/dex/classes.dex $B/unsigned.apk
KS=$ROOT/grimhold.keystore
[ -f $KS ] || keytool -genkeypair -keystore $KS -storepass grimhold -keypass grimhold -alias grimhold -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Grimhold, O=Grimhold, C=RU" 2>&1 | grep -v "Picked up" || true
echo "== sign";          java -jar $T/apksigner.jar sign --ks $KS --ks-pass pass:grimhold --key-pass pass:grimhold --ks-key-alias grimhold --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out $ROOT/dist/Grimhold3D.apk $B/unsigned.apk 2>&1 | grep -v "Picked up" || true
echo "== verify";        java -jar $T/apksigner.jar verify --verbose $ROOT/dist/Grimhold3D.apk 2>&1 | grep -v "Picked up\|WARNING" | head -8
ls -la $ROOT/dist/Grimhold3D.apk
