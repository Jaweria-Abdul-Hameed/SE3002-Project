# Upstream workflows (disabled)

These are Atlas CMMS's own GitHub Actions workflows from the baseline commit
`a3c7ce38adedeb90ac13c280e8ccad6622ff2a42`. They push images to DockerHub,
deploy to Koyeb and publish Expo updates using upstream's secrets, so they must
not run in this fork. They are kept here (outside `.github/workflows/`) only for
reference. Our own CI lives in `.github/workflows/`.
