# Hermetic toolchain for building the raw-BIOS-to-IFR pipeline.
#   docker build -t ifr-wasm-dev tools/bios2ifr
#   docker run --rm -v "$PWD":/repo -w /repo ifr-wasm-dev bash tools/bios2ifr/build.sh /repo/dist
FROM emscripten/emsdk:3.1.74

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl git build-essential pkg-config ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain stable --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustup target add wasm32-unknown-unknown \
    && curl -sSfL https://github.com/rustwasm/wasm-pack/releases/download/v0.13.1/wasm-pack-v0.13.1-x86_64-unknown-linux-musl.tar.gz \
        | tar -xz -C /usr/local/bin --strip-components=1 --wildcards '*/wasm-pack'

WORKDIR /repo
