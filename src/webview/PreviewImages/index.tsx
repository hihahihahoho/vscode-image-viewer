import {
  Button,
  Checkbox,
  Collapse,
  ConfigProvider,
  Empty,
  Image,
  Input,
  Skeleton,
  Slider,
  Space,
  Spin,
  Tag,
  Tooltip
} from 'antd'
import { FolderOpenTwoTone, InfoCircleOutlined, SearchOutlined } from '@ant-design/icons'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MESSAGE_CMD } from '../../constants'
import { callVscode } from '@easy_vscode/webview'
import ImageLazyLoad from './ImageLazyLoad'
import {
  StyledBetweenWrapper,
  StyledFolderOpenTwoTone,
  StyledImgsContainer,
  StyledPicCount,
  StyledPreviewImages,
  StyledReloadOutlined,
  StyleImage,
  StyleImageList,
  StyleRowTitle,
  StyleSquare,
  StyleTopRows
} from './style'
import ImageInfo from './ImageInfo'
import { useDebounceFn, useScroll } from 'ahooks'
import { BUILTIN_MESSAGE_CMD } from '@easy_vscode/core/lib/constants'

const completeImgs = (imgs, projectPath) => {
  return imgs.map((img) => {
    const filePath = img.path
    const dirPath = filePath.substring(0, filePath.lastIndexOf('/') + 1)
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1)
    const fileType = filePath.substring(filePath.lastIndexOf('.') + 1)
    const newImg = {
      ...img,
      fullPath: projectPath + img.path,
      dirPath,
      fileName,
      fileType
    }
    return newImg
  })
}

const backgroundColorOptions = [
  '#ffffff',
  '#cccccc',
  '#999999',
  '#333333',
  '#a89a89',
  '#a9e4af',
  '#f1a8a4',
  '#64bbe2',
  '#8488b6'
]

const THRESHOLD_ALL_COLLAPSED = 1200
const DEFAULT_IMAGE_SIZE = 100
const THRESHOLD_ENABLE_LAZY_LOADING = 150
const THRESHOLD_DELAY_CHANGE_SIZE = 200

export interface IImage {
  // origin properties
  path: string
  fullPath: string
  vscodePath: string
  size: number
  // extend properties
  fileName: string
  fileType: string
  dirPath: string
}

const PreviewImages: React.FC = () => {
  const [imgs, setImgs] = useState<IImage[]>([])
  const [allImageTypes, setAllImageTypes] = useState<string[]>([])
  const [showImageTypes, setShowImageTypes] = useState<string[]>([])
  const [activeKey, setActiveKey] = useState<string[]>([])
  const [allPaths, setAllPaths] = useState<string[]>([])
  const [showImgs, setShowImgs] = useState<IImage[]>([])
  const [backgroundColor, setBackgroundColor] = useState<string>(backgroundColorOptions[1])
  const [keyword, setKeyword] = useState<string>('')
  const [beforeFetch, setBeforeFetch] = useState(true)
  const [loading, setLoading] = useState(false)
  const [size, setSize] = useState<number>(DEFAULT_IMAGE_SIZE)
  const [isScrolling, setIsScrolling] = useState(false)
  const [relativeDir, setRelativeDir] = useState('')
  const initClickFilePath = (window as any).commandArgs?.[0]?.path || ''
  const [clickFilePath, setClickFilePath] = useState(initClickFilePath)
  const [everAutoPreview, setEverAutoPreview] = useState(false)
  const currentProjectPath = useRef('')

  const { run: onDebounceScroll } = useDebounceFn(
    () => {
      setIsScrolling(false)
    },
    {
      wait: 300
    }
  )
  const ref = useRef(null)
  const scroll = useScroll(ref)

  useEffect(() => {
    if (!isScrolling) {
      setIsScrolling(true)
    }
    onDebounceScroll(scroll)
  }, [scroll])

  /**
   * get file directory of path
   */
  const getFileDirectory = (path: string) => {
    return path.substring(0, path.lastIndexOf('/') + 1)
  }

  const refreshImgs = () => {
    setLoading(true)
    callVscode({ cmd: MESSAGE_CMD.GET_ALL_IMGS }, ({ imgs, projectPath }: { imgs: IImage[], projectPath: string }) => {
      currentProjectPath.current = projectPath
      if (clickFilePath) {
        const fileRelativePath = clickFilePath.replace(currentProjectPath.current, '')
        const isFile = /.*\..{3,5}/.test(fileRelativePath)
        const relativeDir = isFile ? getFileDirectory(fileRelativePath) : fileRelativePath
        if (relativeDir === '/') {
          setRelativeDir('')
        } else if (imgs.find((img) => img.path.includes(relativeDir))) {
          setRelativeDir(relativeDir)
        }
      }
      setLoading(false)
      setBeforeFetch(false)
      updateImgs(imgs)
    })
  }
  useEffect(refreshImgs, [])

  const onRevealWebview = useCallback((event) => {
    const message = event?.data
    if (message?.cmd === BUILTIN_MESSAGE_CMD.REVEAL_WEBVIEW) {
      const commandArgs = message.data?.commandArgs
      const clickFilePath = commandArgs?.[0]?.path || ''
      setClickFilePath(clickFilePath)
      if (clickFilePath) {
        const fileRelativePath = clickFilePath.replace(currentProjectPath.current, '')
        const isFile = /.*\..{3,5}/.test(fileRelativePath)
        const relativeDir = isFile ? getFileDirectory(fileRelativePath) : fileRelativePath
        if (relativeDir === '/') {
          setRelativeDir('')
        } else if (imgs.find((img) => img.path.includes(relativeDir))) {
          setRelativeDir(relativeDir)
          setEverAutoPreview(false)
        }
      }
    }
  }, [imgs])

  useEffect(() => {
    window.addEventListener('message', onRevealWebview)
    return () => {
      window.removeEventListener('message', onRevealWebview)
    }
  }, [onRevealWebview])

  const updateImgs = (newImgs) => {
    const imgs = completeImgs(newImgs, currentProjectPath.current)
    setImgs(imgs)
    let allFileTypes: string[] = imgs.map((img) => img.fileType)
    allFileTypes = Array.from(new Set(allFileTypes)).sort()
    setAllImageTypes([...allFileTypes])
    setShowImageTypes([...allFileTypes])
  }

  useEffect(() => {
    let showImgs = imgs
    if (relativeDir) {
      showImgs = showImgs.filter((img) => img.dirPath.indexOf(relativeDir) > -1)
    }
    showImgs = showImgs
      .filter((img) => img.path.indexOf(keyword) > -1)
      .filter((img) => showImageTypes.includes(img.fileType))
    setShowImgs(showImgs)
    let arr: string[] = showImgs.map((img) => img.dirPath)
    arr = Array.from(new Set(arr)).sort()
    setAllPaths(arr)
    const isVeryMany = showImgs.length > THRESHOLD_ALL_COLLAPSED
    setActiveKey(isVeryMany ? [] : [...arr])
  }, [imgs, keyword, showImageTypes, relativeDir])

  const onDeleteImage = (filePath) => {
    const index = imgs.findIndex((img) => img.fullPath === filePath)
    if (index > -1) {
      imgs.splice(index, 1)
      setImgs([...imgs])
    }
  }

  const handleClickOpenFolder = (e, path: string) => {
    e.stopPropagation()
    callVscode({
      cmd: MESSAGE_CMD.OPEN_IMAGE_DIRECTORY,
      data: { path }
    })
  }

  const typeOptions = useMemo(() => {
    return allImageTypes.map((type) => ({
      label: (
        <span>
          {type}
          <StyledPicCount style={{ marginLeft: '4px' }}>
            ({imgs.filter((img) => img.fileType === type).length})
          </StyledPicCount>
        </span>
      ),
      value: type
    }))
  }, [allImageTypes, imgs])

  const handleChangeActiveKey = (value) => {
    setActiveKey([].concat(value))
  }

  const customizeRenderEmpty = () => {
    if (beforeFetch) {
      return <Skeleton active />
    }
    return (
      <div style={{ textAlign: 'center' }}>
        <Empty description='No images found' />
      </div>
    )
  }

  const handlerChangeImageSize = (value) => {
    if (imgs.length < THRESHOLD_DELAY_CHANGE_SIZE) {
      setSize(value)
    }
  }
  const handlerAfterChangeImageSize = (value) => {
    if (imgs.length >= THRESHOLD_DELAY_CHANGE_SIZE) {
      setSize(value)
    }
  }

  const enableLazyLoad = useMemo(() => {
    return showImgs.length > THRESHOLD_ENABLE_LAZY_LOADING
  }, [showImgs])

  const sortImageFn = (a: IImage, b: IImage) => {
    if (clickFilePath && a.fullPath === clickFilePath) {
      return -1
    }
    if (clickFilePath && b.fullPath === clickFilePath) {
      return 1
    }
    return a.fileName < b.fileName ? -1 : 1
  }

  const onAutoPreview = () => {
    setEverAutoPreview(true)
  }

  return (
    <ConfigProvider renderEmpty={customizeRenderEmpty}>
      <Spin spinning={loading}>
        <StyledPreviewImages style={{ padding: '20px' }}>
          <StyleTopRows>
            <Input
              addonBefore={<SearchOutlined />}
              allowClear
              size='middle'
              placeholder='image path/name'
              style={{ width: 'calc(100% - 32px)', marginRight: '8px' }}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <StyledReloadOutlined onClick={refreshImgs} />
          </StyleTopRows>
          {/* Type */}
          <StyleTopRows style={{ marginBottom: '2px' }}>
            <StyledBetweenWrapper>
              <span>
                <StyleRowTitle>Type:</StyleRowTitle>
                <Checkbox.Group
                  options={typeOptions}
                  value={[...showImageTypes]}
                  onChange={(values) => setShowImageTypes(values as string[])}
                />
              </span>
              <span>
                Total count:<StyledPicCount style={{ marginLeft: '6px' }}>{imgs.length}</StyledPicCount>
              </span>
            </StyledBetweenWrapper>
          </StyleTopRows>
          {/* Background */}
          <StyleTopRows style={{ marginBottom: '6px' }}>
            <StyleRowTitle>Background:</StyleRowTitle>
            <span>
              {backgroundColorOptions.map((color) => (
                <StyleSquare
                  onClick={() => setBackgroundColor(color)}
                  isSelected={backgroundColor === color}
                  color={color}
                ></StyleSquare>
              ))}
            </span>
          </StyleTopRows>
          {/* Size */}
          <StyleTopRows style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <StyleRowTitle>Size:</StyleRowTitle>
            <Slider
              style={{ flex: 1 }}
              min={10}
              max={600}
              step={5}
              defaultValue={size}
              onChange={handlerChangeImageSize}
              onAfterChange={handlerAfterChangeImageSize}
            />
          </StyleTopRows>
          {/* Expand/Collapse All */}
          <StyleTopRows>
            <Space>
              <span style={{ color: '#bbb' }}>
                Search result: <span style={{ color: '#333' }}>{showImgs.length}</span>
              </span>
              <Tooltip
                placement='right'
                title={`When there are more than ${THRESHOLD_ALL_COLLAPSED} images(after being filtered) being displayed, all directories are collapsed by default.`}
              >
                <InfoCircleOutlined style={{ fontSize: '16px', color: '#ccc' }} />
              </Tooltip>
              <Button onClick={() => setActiveKey([...allPaths])}>Expand All</Button>
              <Button onClick={() => setActiveKey([])}>Collapse All</Button>
            </Space>
          </StyleTopRows>
          {relativeDir && (
            <StyleTopRows>
              <Tag closable onClose={() => setRelativeDir('')}>Search in: {relativeDir}</Tag>
            </StyleTopRows>
          )}
          <div>
            {allPaths.length === 0 ? (
              customizeRenderEmpty()
            ) : (
              <StyledImgsContainer ref={ref}>
                <Collapse activeKey={activeKey} onChange={handleChangeActiveKey}>
                  {allPaths.map((path) => (
                    <Collapse.Panel
                      header={
                        <span>
                          {path}
                          <StyledPicCount>({showImgs.filter((img) => img.dirPath === path).length})</StyledPicCount>
                          <StyledFolderOpenTwoTone>
                            <FolderOpenTwoTone twoToneColor='#f4d057' onClick={(e) => handleClickOpenFolder(e, path)} />
                          </StyledFolderOpenTwoTone>
                        </span>
                      }
                      key={path}
                    >
                      <StyleImageList>
                        <Image.PreviewGroup>
                          {showImgs
                            .filter((img) => img.dirPath === path)
                            .sort(sortImageFn)
                            .map((img) => (
                              <StyleImage key={img.path}>
                                <ImageLazyLoad
                                  isScrolling={isScrolling}
                                  enableLazyLoad={enableLazyLoad}
                                  img={img}
                                  size={size}
                                  backgroundColor={backgroundColor}
                                  autoPreview={!everAutoPreview && clickFilePath && clickFilePath === img.fullPath}
                                  onAutoPreview={onAutoPreview}
                                />
                                <ImageInfo size={size} img={img} onDeleteImage={onDeleteImage} />
                              </StyleImage>
                            ))}
                        </Image.PreviewGroup>
                      </StyleImageList>
                    </Collapse.Panel>
                  ))}
                </Collapse>
              </StyledImgsContainer>
            )}
          </div>
        </StyledPreviewImages>
      </Spin>
    </ConfigProvider>
  )
}

export default PreviewImages
